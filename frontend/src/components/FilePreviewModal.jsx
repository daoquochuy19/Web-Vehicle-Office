import React from 'react'

/**
 * Modal xem trước file (ảnh, PDF, Office).
 * Props: file (File object), onClose (function)
 */
export default function FilePreviewModal({ file, onClose }) {
  if (!file) return null

  const isImage = /^image\//i.test(file.type)
  const isPdf = file.type === 'application/pdf'
  const isOffice = [
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].includes((file.type || '').toLowerCase())

  const fileUrl = URL.createObjectURL(file)
  const googleDocsUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '20px',
          maxWidth: '80vw',
          width: '80vw',
          maxHeight: '80vh',
          height: '80vh',
          overflow: 'auto',
          position: 'relative',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: '#ef4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          ✕ Đóng
        </button>

        <h3 style={{ marginTop: 0, marginBottom: '20px' }}>{file.name}</h3>

        {isImage && (
          <img
            src={fileUrl}
            alt={file.name}
            style={{ maxWidth: '100%', maxHeight: '70vh', objectFit: 'contain' }}
          />
        )}

        {isPdf && (
          <iframe
            src={fileUrl}
            style={{ width: '100%', height: '65vh', border: 'none' }}
            title={file.name}
          />
        )}

        {isOffice && (
          <iframe
            src={googleDocsUrl}
            style={{ width: '100%', height: '65vh', border: 'none' }}
            title={file.name}
          />
        )}

        {!isImage && !isPdf && !isOffice && (
          <div style={{ padding: '40px', textAlign: 'center', color: '#666' }}>
            <p>Loại file không được hỗ trợ preview</p>
            <p>Vui lòng tải file về để xem</p>
          </div>
        )}
      </div>
    </div>
  )
}
