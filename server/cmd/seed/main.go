package main

import (
	"crypto/rand"
	"fmt"
	"log"
	"os"

	"github.com/oklog/ulid/v2"
	"github.com/rishad/opendrive/server/db"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	username := getEnv("SEED_USERNAME", "admin")
	password := getEnv("SEED_PASSWORD", "")
	dbPath := getEnv("DB_PATH", "./data/opendrive.db")

	if password == "" {
		log.Fatal("password is required: set SEED_PASSWORD env var")
	}

	database, err := db.Open(dbPath)
	if err != nil {
		log.Fatalf("open database: %v", err)
	}
	defer database.Close()

	hashed, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("hash password: %v", err)
	}

	id := ulid.MustNew(ulid.Now(), rand.Reader).String()
	_, err = database.Exec(
		"INSERT INTO users (id, username, password, role) VALUES (?, ?, ?, 'admin')",
		id, username, string(hashed),
	)
	if err != nil {
		log.Fatalf("insert admin: %v (user may already exist)", err)
	}

	fmt.Printf("Admin created: username=%s id=%s\n", username, id)
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
