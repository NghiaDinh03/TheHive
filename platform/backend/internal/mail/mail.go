package mail

import (
	"context"
	"crypto/tls"
	"encoding/json"
	"fmt"
	"net/smtp"
	"strings"
	"github.com/jmoiron/sqlx"
)

type Config struct {
	BaseURL  string
}

type SmtpConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Username string `json:"user"`
	Password string `json:"pass"`
	From     string `json:"from"`
	Enabled  bool   `json:"enabled"`
}

type Sender struct {
	cfg Config
	db  *sqlx.DB
}

func NewSender(cfg Config, db *sqlx.DB) *Sender {
	return &Sender{cfg: cfg, db: db}
}

func (s *Sender) Enabled() bool {
	return s != nil && s.db != nil
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
	
	var smtpCfg SmtpConfig
	var val []byte
	err := s.db.GetContext(ctx, &val, "SELECT value FROM ui_settings WHERE key = 'smtp_config'")
	if err == nil && len(val) > 0 {
		_ = json.Unmarshal(val, &smtpCfg)
	}

	if !smtpCfg.Enabled || smtpCfg.Host == "" {
		return fmt.Errorf("SMTP configuration is disabled or missing")
	}

	addr := fmt.Sprintf("%s:%d", smtpCfg.Host, smtpCfg.Port)
	msg := strings.Join([]string{
		"From: " + smtpCfg.From,
		"To: " + to,
		"Subject: " + subject,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"",
		body,
	}, "\r\n")
	var auth smtp.Auth
	if smtpCfg.Username != "" {
		auth = smtp.PlainAuth("", smtpCfg.Username, smtpCfg.Password, smtpCfg.Host)
	}
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()
	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: smtpCfg.Host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}
	if auth != nil {
		if err := client.Auth(auth); err != nil {
			return err
		}
	}
	if err := client.Mail(smtpCfg.From); err != nil {
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
