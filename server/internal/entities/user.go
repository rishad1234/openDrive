package entities

type User struct {
	ID        string
	Username  string
	Password  string
	Role      Role
	Email     *string // optional
	CreatedAt string
}
