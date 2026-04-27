package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"net/smtp"
	"strings"
)

type Config struct {
	Enabled  bool
	Host     string
	Port     int
	Username string
	Password string
	From     string
	BaseURL  string
}

type Sender struct {
	cfg Config
}

func NewSender(cfg Config) *Sender {
	return &Sender{cfg: cfg}
}

func (s *Sender) Enabled() bool {
	return s != nil && s.cfg.Enabled && s.cfg.Host != "" && s.cfg.From != ""
}

func (s *Sender) SendPasswordReset(ctx context.Context, to, token string) error {
	if !s.Enabled() {
		return nil
	}
	link := strings.TrimRight(s.cfg.BaseURL, "/") + "/reset-password?token=" + token
	subject := "TheHive password reset"
	body := "Use this one-time token to reset your password.\n\nToken: " + token + "\nLink: " + link + "\n\nThis token expires in 30 minutes."
	return s.send(ctx, to, subject, body)
}

func (s *Sender) SendInvite(ctx context.Context, to, token string) error {
	if !s.Enabled() {
		return nil
	}
	link := strings.TrimRight(s.cfg.BaseURL, "/") + "/reset-password?token=" + token
	subject := "TheHive account invitation"
	body := "An administrator invited you to TheHive. Set your password using this one-time token.\n\nToken: " + token + "\nLink: " + link + "\n\nThis token expires in 30 minutes."
	return s.send(ctx, to, subject, body)
}

func (s *Sender) send(ctx context.Context, to, subject, body string) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}
	addr := fmt.Sprintf("%s:%d", s.cfg.Host, s.cfg.Port)
	msg := strings.Join([]string{
		"From: " + s.cfg.From,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")
	var auth smtp.Auth
	if s.cfg.Username != "" {
		auth = smtp.PlainAuth("", s.cfg.Username, s.cfg.Password, s.cfg.Host)
	}
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: s.cfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(s.cfg.From); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}
	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte(msg)); err != nil {
		_ = writer.Close()
		return err
	}
	return writer.Close()
}
