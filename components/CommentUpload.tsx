"use client";

import { useState, useRef } from "react";
import { Upload, X, FileImage, FileVideo, AlertCircle } from "lucide-react";

interface UploadedFile {
  key: string;
  url: string;
  kind: "image" | "video";
  mimeType: string;
  size: number;
  name: string;
}

interface CommentUploadProps {
  onFilesChange: (files: UploadedFile[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

interface UploadResponse {
  url: string;
  fields: Record<string, string>;
  key: string;
  policy: {
    kind: "image" | "video";
    limits: {
      imageMaxBytes: number;
      videoMaxBytes: number;
      videoMaxDurationSeconds: number;
    };
  };
}

interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

export default function CommentUpload({ onFilesChange, maxFiles = 3, disabled }: CommentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const removeFile = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    setFiles(newFiles);
    onFilesChange(newFiles);
  };

  const addError = (filename: string, message: string) => {
    setErrors(prev => ({ ...prev, [filename]: message }));
    setTimeout(() => {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[filename];
        return newErrors;
      });
    }, 5000);
  };

  const uploadFile = async (file: File): Promise<UploadedFile | null> => {
    try {
      // Determine file kind
      const kind = file.type.startsWith('image/') ? 'image' : 
                   file.type.startsWith('video/') ? 'video' : null;
      
      if (!kind) {
        addError(file.name, 'Only image and video files are supported');
        return null;
      }

      // Request presigned URL
      const signResponse = await fetch('/api/r2/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          mimeType: file.type,
          size: file.size,
          kind,
        }),
      });

      const signData: UploadResponse | ErrorResponse = await signResponse.json();

      if (!signResponse.ok || 'error' in signData) {
        addError(file.name, 'error' in signData ? signData.error.message : 'Failed to get upload URL');
        return null;
      }

      // Upload file to S3/R2
      const formData = new FormData();
      Object.entries(signData.fields).forEach(([key, value]) => {
        formData.append(key, value);
      });
      formData.append('file', file);

      const uploadResponse = await fetch(signData.url, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        addError(file.name, 'Upload failed');
        return null;
      }

      // Return successful upload info
      return {
        key: signData.key,
        url: signData.url.replace(/\?.*$/, '') + '/' + signData.key, // Simple URL construction
        kind: signData.policy.kind,
        mimeType: file.type,
        size: file.size,
        name: file.name,
      };

    } catch (error) {
      console.error('Upload error:', error);
      addError(file.name, 'Upload failed');
      return null;
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    
    if (files.length + selectedFiles.length > maxFiles) {
      addError('limit', `Maximum ${maxFiles} files allowed`);
      return;
    }

    for (const file of selectedFiles) {
      const fileId = `${file.name}-${file.size}`;
      setUploading(prev => new Set(prev.add(fileId)));

      const uploadedFile = await uploadFile(file);
      
      setUploading(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileId);
        return newSet;
      });

      if (uploadedFile) {
        const newFiles = [...files, uploadedFile];
        setFiles(newFiles);
        onFilesChange(newFiles);
      }
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (kind: string) => {
    return kind === 'image' ? FileImage : FileVideo;
  };

  return (
    <div className="space-y-3">
      {/* Upload Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled || files.length >= maxFiles}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="w-4 h-4" />
          Add media
        </button>
        <span className="text-xs text-gray-500">
          {files.length}/{maxFiles} files
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Errors */}
      {Object.entries(errors).map(([filename, message]) => (
        <div key={filename} className="flex items-center gap-2 p-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {filename === 'limit' ? message : `${filename}: ${message}`}
        </div>
      ))}

      {/* Uploading Files */}
      {Array.from(uploading).map(fileId => (
        <div key={fileId} className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Uploading {fileId.split('-')[0]}...</span>
        </div>
      ))}

      {/* Uploaded Files */}
      {files.map((file, index) => {
        const Icon = getFileIcon(file.kind);
        return (
          <div key={file.key} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded">
            <Icon className="w-5 h-5 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-gray-900 truncate">
                {file.name}
              </div>
              <div className="text-xs text-gray-500">
                {file.kind} • {formatFileSize(file.size)}
              </div>
            </div>
            {!disabled && (
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-gray-400 hover:text-red-600 focus:outline-none"
                aria-label="Remove file"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}