package auth

import "golang.org/x/crypto/bcrypt"

// bcryptCost is the cost every password is stored at (accounts spec).
const bcryptCost = 12

// HashPassword returns the bcrypt hash of password at cost 12.
func HashPassword(password string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

// checkPassword reports whether password matches the stored hash.
func checkPassword(hash, password string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password)) == nil
}
