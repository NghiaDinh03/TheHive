'use client';

/**
 * Dropzone — mirrors TheHive 4 legacy dropzone.html.
 * File drop zone with drag-and-drop support for attachment uploads.
 */

import { useCallback, useState, type DragEvent } from 'react';

type DropzoneProps = {
  onFileDrop?: (file: File) => void;
  onFile?: (file: File) => void;
  disabled?: boolean;
  accept?: string;
  label?: string;
  className?: string;
  compact?: boolean;
};

export function Dropzone({ onFileDrop, onFile, disabled, accept, label = 'Drop file or click to select', className, compact }: DropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const handleFile = useCallback((file: File) => {
    if (onFile) onFile(file);
    else if (onFileDrop) onFileDrop(file);
  }, [onFile, onFileDrop]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  }, [disabled]);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [disabled, handleFile]);

  const handleClick = useCallback(() => {
    if (disabled) return;
    const input = document.createElement('input');
    input.type = 'file';
    if (accept) input.accept = accept;
    input.onchange = () => {
      const file = input.files?.[0];
      if (file) handleFile(file);
    };
    input.click();
  }, [disabled, accept, handleFile]);

  if (compact) {
    return (
      <button
        type="button"
        className={`btn btn-default btn-sm ${className ?? ''}`}
        onClick={handleClick}
        disabled={disabled}
        title={label}
      >
        <i className="fa fa-paperclip" /> Attach
      </button>
    );
  }

  return (
    <div
      className={`dropzone ${isDragging ? 'dropzone-active' : ''} ${disabled ? 'dropzone-disabled' : ''} ${className ?? ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={handleClick}
    >
      <div className="dropzone-content">
        <i className="fa fa-cloud-upload" style={{ fontSize: '1.5rem', color: isDragging ? '#3c8dbc' : '#999', marginBottom: 4 }} />
        <span className="dropzone-label">{label}</span>
      </div>
    </div>
  );
}
