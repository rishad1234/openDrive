package config

import (
	"log"
	"os"
)

type Config struct {
	Port string

	JWTSecret string

	DBPath string

	R2Endpoint        string
	R2AccessKeyID     string
	R2SecretAccessKey string
	R2Bucket          string
	R2Region          string
}

func Load() *Config {
	cfg := &Config{
		Port:              getEnv("PORT", "3000"),
		JWTSecret:         requireEnv("JWT_SECRET"),
		DBPath:            getEnv("DB_PATH", "./data/opendrive.db"),
		R2Endpoint:        requireEnv("R2_ENDPOINT"),
		R2AccessKeyID:     requireEnv("R2_ACCESS_KEY_ID"),
		R2SecretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
		R2Bucket:          requireEnv("R2_BUCKET"),
		R2Region:          getEnv("R2_REGION", "auto"),
	}
	return cfg
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required environment variable %q is not set", key)
	}
	return v
}
