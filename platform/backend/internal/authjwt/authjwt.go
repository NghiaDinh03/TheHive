package authjwt

import (
	"fmt"
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

func Sign(secret string, expiry time.Duration, login, organisation, profile string, permissions []string) (string, string, time.Time, error) {
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
	token, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		return "", "", time.Time{}, err
	}
	return token, tokenID, expiresAt, nil
}

func Parse(secret, tokenValue string) (*Claims, error) {
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(tokenValue, claims, func(token *jwt.Token) (any, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method %v", token.Header["alg"])
		}
		return []byte(secret), nil
	})
	if err != nil {
		return nil, err
	}
	if !token.Valid {
		return nil, fmt.Errorf("invalid token")
	}
	return claims, nil
}

func HasPermission(claims *Claims, required string) bool {
	if claims == nil || required == "" {
		return false
	}
	for _, permission := range claims.Permissions {
		if permission == required || permission == "manageConfig" {
			return true
		}
	}
	return false
}
