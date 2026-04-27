package mq

import (
	"context"
	"fmt"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
	"go.uber.org/zap"
)

type Client struct {
	url             string
	reconnectDelay  time.Duration
	connectTimeout  time.Duration
	log             *zap.Logger
	mu              sync.RWMutex
	conn            *amqp.Connection
	channel         *amqp.Channel
	closeNotifyConn chan *amqp.Error
}

type Config struct {
	URL             string
	ConnectTimeout  time.Duration
	ReconnectDelay  time.Duration
}

func New(cfg Config, log *zap.Logger) *Client {
	return &Client{
		url:            cfg.URL,
		reconnectDelay: cfg.ReconnectDelay,
		connectTimeout: cfg.ConnectTimeout,
		log:            log,
	}
}

func (c *Client) Connect(ctx context.Context) error {
	deadline := time.Now().Add(c.connectTimeout)
	var lastErr error
	for time.Now().Before(deadline) {
		if err := ctx.Err(); err != nil {
			return err
		}
		conn, err := amqp.Dial(c.url)
		if err != nil {
			lastErr = err
			c.log.Warn("rabbitmq dial failed, retrying",
				zap.Error(err),
				zap.Duration("backoff", c.reconnectDelay))
			time.Sleep(c.reconnectDelay)
			continue
		}
		ch, err := conn.Channel()
		if err != nil {
			_ = conn.Close()
			lastErr = err
			time.Sleep(c.reconnectDelay)
			continue
		}
		c.mu.Lock()
		c.conn = conn
		c.channel = ch
		c.closeNotifyConn = conn.NotifyClose(make(chan *amqp.Error, 1))
		c.mu.Unlock()
		c.log.Info("rabbitmq connected")
		return nil
	}
	return fmt.Errorf("rabbitmq connect timeout: %w", lastErr)
}

func (c *Client) Ping() error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if c.conn == nil || c.conn.IsClosed() {
		return fmt.Errorf("rabbitmq not connected")
	}
	return nil
}

func (c *Client) Close() error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.channel != nil {
		_ = c.channel.Close()
	}
	if c.conn != nil && !c.conn.IsClosed() {
		return c.conn.Close()
	}
	return nil
}
