package authjwt

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"os"
	"sync"
	"time"

	"github.com/golang-jwt/jwt"
	"github.com/google/uuid"
)

type Claims struct {
	Login        string   `json:"login"`
	Organisation string   `json:"organisation"`
	Profile      string   `json:"profile"`
	Permissions  []string `json:"permissions"`
	jwt.StandardClaims
}

var (
	rsaPrivateKey *rsa.PrivateKey
	rsaPublicKey  *rsa.PublicKey
	rsaOnce       sync.Once
)

func initKeys(secret string) {
	rsaOnce.Do(func() {
		// Thử tìm file key chỉ định trong docker secrets hoặc môi trường
		privPath := os.Getenv("JWT_PRIVATE_KEY_PATH")
		pubPath := os.Getenv("JWT_PUBLIC_KEY_PATH")

		if privPath == "" {
			privPath = "jwt_private.pem"
		}
		if pubPath == "" {
			pubPath = "jwt_public.pem"
		}

		privBytes, errPriv := os.ReadFile(privPath)
		pubBytes, errPub := os.ReadFile(pubPath)

		if errPriv == nil && errPub == nil {
			blockPriv, _ := pem.Decode(privBytes)
			blockPub, _ := pem.Decode(pubBytes)

			if blockPriv != nil && blockPub != nil {
				privKey, err1 := x509.ParsePKCS1PrivateKey(blockPriv.Bytes)
				pubKeyInterface, err2 := x509.ParsePKIXPublicKey(blockPub.Bytes)
				if err1 == nil && err2 == nil {
					if pubKey, ok := pubKeyInterface.(*rsa.PublicKey); ok {
						rsaPrivateKey = privKey
						rsaPublicKey = pubKey
						return
					}
				}
			}
		}

		// Fallback: Tự sinh ngẫu nhiên cặp khóa RSA 2048-bit trực tiếp trong bộ nhớ RAM
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err == nil {
			rsaPrivateKey = key
			rsaPublicKey = &key.PublicKey
		}
	})
}

func Sign(secret string, expiry time.Duration, login, organisation, profile string, permissions []string) (string, string, time.Time, error) {
	initKeys(secret)
	if expiry <= 0 {
		expiry = time.Hour
	}
	now := time.Now().UTC()
	expiresAt := now.Add(expiry)
	tokenID := uuid.NewString()
	claims := Claims{
		Login:        login,
		Organisation: organisation,
		Profile:      profile,
		Permissions:  permissions,
		StandardClaims: jwt.StandardClaims{
			Id:        tokenID,
			Subject:   login,
			IssuedAt:  now.Unix(),
			ExpiresAt: expiresAt.Unix(),
			Issuer:    "thehive-platform",
		},
	}
	
	// Sử dụng SigningMethodRS256 ký bằng RSA Private Key nhúng
	token, err := jwt.NewWithClaims(jwt.SigningMethodRS256, claims).SignedString(rsaPrivateKey)
	if err != nil {
		return "", "", time.Time{}, err
	}
	return token, tokenID, expiresAt, nil
}

func Parse(secret, tokenValue string) (*Claims, error) {
	initKeys(secret)
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenValue, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}
		return rsaPublicKey, nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

var LegacyPermissions = []string{
	"accessTheHiveFS",
	"manageAction",
	"manageAlert",
	"manageAnalyse",
	"manageAnalyzerTemplate",
	"manageCase",
	"manageCaseTemplate",
	"manageConfig",
	"manageCustomField",
	"manageObservable",
	"manageObservableTemplate",
	"manageOrganisation",
	"managePage",
	"managePattern",
	"managePlatform",
	"manageProcedure",
	"manageProfile",
	"manageShare",
	"manageTag",
	"manageTask",
	"manageTaxonomy",
	"manageUser",
}

var legacyPermissionSet = func() map[string]struct{} {
	out := make(map[string]struct{}, len(LegacyPermissions))
	for _, permission := range LegacyPermissions {
		out[permission] = struct{}{}
	}
	return out
}()

func IsLegacyPermission(permission string) bool {
	_, ok := legacyPermissionSet[permission]
	return ok
}

func HasPermission(claims *Claims, required string) bool {
	if claims == nil || required == "" {
		return false
	}
	for _, permission := range claims.Permissions {
		if permission == required || permission == "managePlatform" {
			return true
		}
	}
	return false
}
