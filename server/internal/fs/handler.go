package fs

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/aws/aws-sdk-go-v2/service/s3/types"
	"github.com/rishad/opendrive/server/internal/middleware"
)

type Handler struct {
	s3     *s3.Client
	bucket string
}

func NewHandler(s3Client *s3.Client, bucket string) *Handler {
	return &Handler{s3: s3Client, bucket: bucket}
}

type listResponse struct {
	Folders []string    `json:"folders"`
	Files   []FileEntry `json:"files"`
}

type FileEntry struct {
	Key          string `json:"key"`
	Name         string `json:"name"`
	Size         int64  `json:"size"`
	LastModified string `json:"last_modified"`
}

// userPrefix returns the R2 key prefix for the calling user.
// Admins can pass any prefix; regular users are restricted to their own namespace.
func (h *Handler) userPrefix(r *http.Request, requestedPrefix string) (string, error) {
	claims := middleware.GetClaims(r)
	base := "users/" + claims.UserID + "/"

	if claims.Role == "admin" {
		// Admin can browse any prefix (including "users/" root)
		if requestedPrefix == "" {
			return "users/", nil
		}
		return requestedPrefix, nil
	}

	// Regular user: enforce their own namespace
	if requestedPrefix == "" {
		return base, nil
	}
	if !strings.HasPrefix(requestedPrefix, base) {
		return "", fmt.Errorf("access denied")
	}
	return requestedPrefix, nil
}

func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	requestedPrefix := r.URL.Query().Get("prefix")
	prefix, err := h.userPrefix(r, requestedPrefix)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	out, err := h.s3.ListObjectsV2(r.Context(), &s3.ListObjectsV2Input{
		Bucket:    aws.String(h.bucket),
		Prefix:    aws.String(prefix),
		Delimiter: aws.String("/"),
	})
	if err != nil {
		http.Error(w, "failed to list objects", http.StatusInternalServerError)
		return
	}

	resp := listResponse{Folders: []string{}, Files: []FileEntry{}}

	for _, cp := range out.CommonPrefixes {
		resp.Folders = append(resp.Folders, aws.ToString(cp.Prefix))
	}

	for _, obj := range out.Contents {
		key := aws.ToString(obj.Key)
		// Skip .keep marker files
		if strings.HasSuffix(key, "/.keep") {
			continue
		}
		name := key[strings.LastIndex(key, "/")+1:]
		var size int64
		if obj.Size != nil {
			size = *obj.Size
		}
		resp.Files = append(resp.Files, FileEntry{
			Key:          key,
			Name:         name,
			Size:         size,
			LastModified: obj.LastModified.Format("2006-01-02T15:04:05Z"),
		})
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

func (h *Handler) Upload(w http.ResponseWriter, r *http.Request) {
	const maxFileSize = 1 << 30 // 1 GB

	r.Body = http.MaxBytesReader(w, r.Body, maxFileSize)

	requestPrefix := r.URL.Query().Get("prefix")
	prefix, err := h.userPrefix(r, requestPrefix)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseMultipartForm(32 << 20); err != nil {
		http.Error(w, "file exceeds the 1 GB limit", http.StatusRequestEntityTooLarge)
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "no file in request", http.StatusBadRequest)
		return
	}
	defer file.Close()

	if header.Size > maxFileSize {
		http.Error(w, "file exceeds the 1 GB limit", http.StatusRequestEntityTooLarge)
		return
	}

	key := prefix + header.Filename

	_, err = h.s3.PutObject(r.Context(), &s3.PutObjectInput{
		Bucket:        aws.String(h.bucket),
		Key:           aws.String(key),
		Body:          file,
		ContentLength: aws.Int64(header.Size),
		ContentType:   aws.String(header.Header.Get("Content-Type")),
	})
	if err != nil {
		http.Error(w, "failed to upload file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

func (h *Handler) Download(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	if _, err := h.userPrefix(r, key); err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	out, err := h.s3.GetObject(r.Context(), &s3.GetObjectInput{
		Bucket: aws.String(h.bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer out.Body.Close()

	name := key[strings.LastIndex(key, "/")+1:]
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, name))
	if out.ContentType != nil {
		w.Header().Set("Content-Type", *out.ContentType)
	}
	if out.ContentLength != nil {
		w.Header().Set("Content-Length", fmt.Sprintf("%d", *out.ContentLength))
	}

	io.Copy(w, out.Body)
}

func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		http.Error(w, "key required", http.StatusBadRequest)
		return
	}
	if _, err := h.userPrefix(r, key); err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	// If key ends with "/" it's a folder — delete recursively
	if strings.HasSuffix(key, "/") {
		if err := h.deleteFolder(r.Context(), key); err != nil {
			http.Error(w, "failed to delete folder", http.StatusInternalServerError)
			return
		}
	} else {
		_, err := h.s3.DeleteObject(r.Context(), &s3.DeleteObjectInput{
			Bucket: aws.String(h.bucket),
			Key:    aws.String(key),
		})
		if err != nil {
			http.Error(w, "failed to delete file", http.StatusInternalServerError)
			return
		}
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteFolder(ctx context.Context, prefix string) error {
	paginator := s3.NewListObjectsV2Paginator(h.s3, &s3.ListObjectsV2Input{
		Bucket: aws.String(h.bucket),
		Prefix: aws.String(prefix),
	})

	for paginator.HasMorePages() {
		page, err := paginator.NextPage(ctx)
		if err != nil {
			return err
		}
		if len(page.Contents) == 0 {
			continue
		}

		var objects []types.ObjectIdentifier
		for _, obj := range page.Contents {
			objects = append(objects, types.ObjectIdentifier{Key: obj.Key})
		}

		_, err = h.s3.DeleteObjects(ctx, &s3.DeleteObjectsInput{
			Bucket: aws.String(h.bucket),
			Delete: &types.Delete{Objects: objects},
		})
		if err != nil {
			return err
		}
	}
	return nil
}

type mkdirRequest struct {
	Prefix string `json:"prefix"`
}

func (h *Handler) Mkdir(w http.ResponseWriter, r *http.Request) {
	var req mkdirRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if !strings.HasSuffix(req.Prefix, "/") {
		req.Prefix += "/"
	}

	prefix, err := h.userPrefix(r, req.Prefix)
	if err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	_, err = h.s3.PutObject(r.Context(), &s3.PutObjectInput{
		Bucket:        aws.String(h.bucket),
		Key:           aws.String(prefix + ".keep"),
		Body:          strings.NewReader(""),
		ContentLength: aws.Int64(0),
	})
	if err != nil {
		http.Error(w, "failed to create folder", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
}

type moveRequest struct {
	Src string `json:"src"`
	Dst string `json:"dst"`
}

func (h *Handler) Move(w http.ResponseWriter, r *http.Request) {
	var req moveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if _, err := h.userPrefix(r, req.Src); err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	if _, err := h.userPrefix(r, req.Dst); err != nil {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	_, err := h.s3.CopyObject(r.Context(), &s3.CopyObjectInput{
		Bucket:     aws.String(h.bucket),
		CopySource: aws.String(h.bucket + "/" + req.Src),
		Key:        aws.String(req.Dst),
	})
	if err != nil {
		http.Error(w, "failed to move file", http.StatusInternalServerError)
		return
	}

	_, err = h.s3.DeleteObject(r.Context(), &s3.DeleteObjectInput{
		Bucket: aws.String(h.bucket),
		Key:    aws.String(req.Src),
	})
	if err != nil {
		http.Error(w, "failed to remove original file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}
