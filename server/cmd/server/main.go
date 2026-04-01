package main

import (
	"context"
	"log"
	"net/http"

	"github.com/aws/aws-sdk-go-v2/aws"
	awsconfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"

	"github.com/rishad/opendrive/server/db"
	"github.com/rishad/opendrive/server/internal/auth"
	"github.com/rishad/opendrive/server/internal/config"
	"github.com/rishad/opendrive/server/internal/fs"
	"github.com/rishad/opendrive/server/internal/mapper"
	"github.com/rishad/opendrive/server/internal/middleware"
	"github.com/rishad/opendrive/server/internal/user"
)

func main() {
	cfg := config.Load()

	database, err := db.Open(cfg.DBPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	s3Client, err := newS3Client(cfg)
	if err != nil {
		log.Fatalf("create s3 client: %v", err)
	}

	userMapper := mapper.NewUserMapper(database)
	tokenMapper := mapper.NewTokenMapper(database)

	authHandler := auth.NewHandler(userMapper, tokenMapper, cfg.JWTSecret)
	fsHandler := fs.NewHandler(s3Client, cfg.R2Bucket)
	userHandler := user.NewHandler(userMapper)

	r := chi.NewRouter()
	r.Use(chimiddleware.Logger)
	r.Use(chimiddleware.Recoverer)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"*"},
		AllowedMethods: []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Authorization", "Content-Type"},
	}))

	// Public routes
	r.Post("/api/auth/login", authHandler.Login)

	// Authenticated routes
	r.Group(func(r chi.Router) {
		r.Use(middleware.Auth(cfg.JWTSecret, userMapper, tokenMapper))

		r.Get("/api/auth/me", authHandler.Me)
		r.Post("/api/auth/logout", authHandler.Logout)
		r.Patch("/api/user/profile", userHandler.Profile)

		r.Get("/api/fs/list", fsHandler.List)
		r.Post("/api/fs/upload", fsHandler.Upload)
		r.Get("/api/fs/download", fsHandler.Download)
		r.Delete("/api/fs/delete", fsHandler.Delete)
		r.Post("/api/fs/mkdir", fsHandler.Mkdir)
		r.Post("/api/fs/move", fsHandler.Move)

		// Admin only routes
		r.Group(func(r chi.Router) {
			r.Use(middleware.AdminOnly)
			r.Get("/api/admin/users", userHandler.List)
			r.Post("/api/admin/users", userHandler.Create)
			r.Delete("/api/admin/users/{id}", userHandler.Delete)
			r.Patch("/api/admin/users/{id}", userHandler.Update)
		})
	})

	log.Printf("server listening on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("server error: %v", err)
	}
}

func newS3Client(cfg *config.Config) (*s3.Client, error) {
	awsCfg, err := awsconfig.LoadDefaultConfig(context.Background(),
		awsconfig.WithCredentialsProvider(
			credentials.NewStaticCredentialsProvider(cfg.R2AccessKeyID, cfg.R2SecretAccessKey, ""),
		),
		awsconfig.WithRegion(cfg.R2Region),
	)
	if err != nil {
		return nil, err
	}

	client := s3.NewFromConfig(awsCfg, func(o *s3.Options) {
		o.BaseEndpoint = aws.String(cfg.R2Endpoint)
		o.UsePathStyle = true
	})

	return client, nil
}
