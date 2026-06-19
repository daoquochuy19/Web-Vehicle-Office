import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

// File Preview Modal Component
function FilePreviewModal({ file, onClose }) {
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

export default function VehicleRegistration(){
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    typePartner: 'office',
    registrationType: '',
    company: '',
    premises: '',
    vehicleType: '',
    ownershipType: false,
    feeConfig: '',
    paymentMethod: '',
    userName: '',
    licensePlate: '',
    effectiveDate: ''
  })
  const [landlords, setLandlords] = useState([])
  const [typePartnerOptions, setTypePartnerOptions] = useState([])
  const [registrationTypeOptions, setRegistrationTypeOptions] = useState([])
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([])
  const [feeConfigOptions, setFeeConfigOptions] = useState([])
  const [landlordLoading, setLandlordLoading] = useState(false)
  const [landlordError, setLandlordError] = useState('')
  const [requiredDocs, setRequiredDocs] = useState([])
  const [docFileNames, setDocFileNames] = useState({})
  const [docFiles, setDocFiles] = useState({})
  const [docAttachmentIds, setDocAttachmentIds] = useState({})
  const [previewFile, setPreviewFile] = useState(null)

  useEffect(() => {
    if (localStorage.getItem('loggedIn') !== 'true') {
      navigate('/', { replace: true })
    }
  }, [navigate])

  // Fetch danh sách công ty (res.partner) từ Odoo qua batch endpoint
  useEffect(() => {
    async function fetchMasterData() {
      setLandlordLoading(true)
      setLandlordError('')
      try {
        const res = await fetch('/api/v1/data/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
            ...(localStorage.getItem('accessToken')
              ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
              : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            queries: [
              {
                key: 'partners',
                model: 'res.partner',
                fields: ['id', 'name'],
                domain: [],
                limit: 100,
                offset: 0,
                order: 'name asc',
                depth: 0,
              },
              {
                key: 'vehicle_types',
                model: 'vehicle.type',
                fields: ['id', 'name'],
                domain: [],
                limit: 200,
                offset: 0,
                order: 'name asc',
                depth: 0,
              },
              {
                key: 'fee_configs',
                model: 'fee.building.config',
                fields: ['id', 'name'],
                domain: [
                  [
                    'state',
                    '=',
                    'active'
                  ],
                  [
                    'type_fee',
                    '=',
                    'deposit'
                  ]
                ],
                limit: 200,
                offset: 0,
                order: 'name asc',
                depth: 0,
              }
            ],
            selections: [
              {
                key: 'type_partner_options',
                model: 'vehicle.card.register',
                field: 'type_partner'
              },
              {
                key: 'registration_type_options',
                model: 'vehicle.card.register',
                field: 'registration_type'
              }
            ]
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        console.log('[batch response]', data)

        const result = data.result?.DATA || {}
        setLandlords(result.partners ?? [])
        setTypePartnerOptions(result.type_partner_options ?? [])
        setRegistrationTypeOptions(result.registration_type_options ?? [])
        setVehicleTypeOptions(result.vehicle_types ?? [])
        setFeeConfigOptions(result.fee_configs ?? [])
      } catch (err) {
        console.error('Fetch master data error:', err)
        setLandlordError('Không thể tải cấu hình dữ liệu')
      } finally {
        setLandlordLoading(false)
      }
    }
    fetchMasterData()
  }, [])

  const fetchRequiredDocuments = async (data) => {
    if (!data.typePartner || !data.registrationType || !data.vehicleType) {
      setRequiredDocs([])
      setDocFileNames({})
      setDocFiles({})
      setDocAttachmentIds({})
      return
    }

    try {
      const res = await fetch('/api/v1/rpc/vehicle.card.register/get_required_documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
          ...(localStorage.getItem('accessToken')
            ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          args: [],
          kwargs: {
            conditions: {
              type_partner: data.typePartner,
              registration_type: data.registrationType,
              is_vip: false,
              is_not_owner: false,
              vehicle_type_id: Number(data.vehicleType),
            },
          },
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const response = await res.json()
      console.log('[required documents response]', response)
      const result = response.result?.DATA || response.DATA || []
      setRequiredDocs(result)
      setDocFileNames({})
      setDocFiles({})
      setDocAttachmentIds({})
    } catch (err) {
      console.error('Fetch required documents error:', err)
      setRequiredDocs([])
    }
  }

  const normalizeSelectOption = (option) => {
    if (Array.isArray(option)) {
      return {
        value: option[0],
        label: option[1] ?? option[0],
      }
    }

    if (option && typeof option === 'object') {
      return {
        value: option.value ?? option.id ?? option[0],
        label: option.label ?? option.name ?? option.display_name ?? String(option.value ?? option.id ?? option),
      }
    }

    return {
      value: option,
      label: String(option),
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    const nextFormData = {
      ...formData,
      [name]: value,
    }
    setFormData(nextFormData)

    if (name === 'typePartner' || name === 'registrationType' || name === 'vehicleType') {
      fetchRequiredDocuments(nextFormData)
    }
  }

  const uploadFileToOdoo = async (file) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/v1/parking/upload-document', {
        method: 'POST',
        headers: {
          'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
          ...(localStorage.getItem('accessToken')
            ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            : {}),
        },
        credentials: 'include',
        body: formData
      })
      
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[upload document response]', data)
      
      // Lấy attachment ID từ response
      const attachmentId = data.result?.DATA?.attachments?.[0]?.id || data.result?.DATA?.id
      return attachmentId
    } catch (err) {
      console.error('Upload document error:', err)
      alert('Tải tài liệu lên thất bại')
      return null
    }
  }

  const handleRequiredDocFileChange = async (e, docId) => {
    const file = e.target.files?.[0]
    if (!file) return

    setDocFileNames(prev => ({
      ...prev,
      [docId]: file.name
    }))
    setDocFiles(prev => ({
      ...prev,
      [docId]: file
    }))

    const attachmentId = await uploadFileToOdoo(file)
    if (attachmentId) {
      setDocAttachmentIds(prev => ({
        ...prev,
        [docId]: attachmentId
      }))
    }
  }

  const canPreview = (mimetype) => {
    if (!mimetype) return false
    if (/^image\//i.test(mimetype)) return true
    if (mimetype === 'application/pdf') return true
    const officeTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]
    return officeTypes.includes(mimetype.toLowerCase())
  }

  const isImage = (file) => {
    return (file?.type || '').startsWith('image/')
  }

  const isPdf = (file) => {
    return (file?.type || '') === 'application/pdf'
  }

  const isOffice = (file) => {
    const officeTypes = [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]
    return officeTypes.includes((file?.type || '').toLowerCase())
  }

  const getGoogleDocsUrl = (file) => {
    const fileUrl = URL.createObjectURL(file)
    return `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`
  }

  const openPreview = (file) => {
    if (!canPreview(file.type)) {
      alert('Không thể xem trước loại file này. Vui lòng tải về để xem.')
      return
    }
    setPreviewFile(file)
  }

  const closePreview = () => {
    setPreviewFile(null)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const now = new Date()
    const pad = (value) => String(value).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const lineDocumentIds = requiredDocs.map((doc, index) => {
      const documentId = doc.document_parking_card_id ?? doc.id ?? doc.code ?? index
      const attachmentKey = String(doc.id ?? doc.code ?? index)
      const attachmentId = docAttachmentIds[attachmentKey]

      return [
        0,
        0,
        {
          document_parking_card_id: Number(documentId),
          attachment_ids: attachmentId ? [attachmentId] : null,
        },
      ]
    })

    const payload = {
      type_partner: formData.typePartner,
      vehicle_type_id: Number(formData.vehicleType),
      license_plate: formData.licensePlate,
      building_house_id: 1718,
      registration_type: formData.registrationType,
      registration_method: 'online',
      registrant_id: Number(formData.company),
      vehicle_user_id: Number(formData.company),
      is_vip: false,
      is_not_owner: !formData.ownershipType,
      is_company_registration: false,
      is_special: false,
      note: '',
      date_request: dateRequest,
      date_used: formData.effectiveDate,
      time_return: 16.0,
      time_return_to: 17.0,
      line_document_ids: lineDocumentIds,
    }

    try {
      const res = await fetch('/api/v1/parking/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Odoo-Database': import.meta.env.VITE_ODOO_DB,
          ...(localStorage.getItem('accessToken')
            ? { 'Authorization': `Bearer ${localStorage.getItem('accessToken')}` }
            : {}),
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[create registration response]', data)
      alert('Phiếu đăng ký đã được tạo thành công')
      // Optional: navigate to another page or reset form here
    } catch (err) {
      console.error('Create registration error:', err)
      alert('Tạo phiếu đăng ký thất bại')
    }
  }

  const handleClose = () => {
    navigate('/')
  }

  return (
    <>
      <main className="page-shell vehicle-registration-shell-no-bg">
      <section className="registration-form-container">
        <h2>Thông tin phiếu đăng ký</h2>

        <div className="form-layout-2col">
          {/* Left column: Form inputs */}
          <div className="form-left">
            <form onSubmit={handleSubmit} className="vehicle-registration-form">
              {/* Row 1 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Đối tượng đăng ký <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    name="typePartner"
                    value={formData.typePartner}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Chọn đối tượng đăng ký --</option>
                    {typePartnerOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark">Hình thức đăng ký <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    name="registrationType"
                    value={formData.registrationType}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Chọn hình thức đăng ký --</option>
                    {registrationTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Công ty <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    name="company"
                    value={formData.company}
                    onChange={handleChange}
                    className="form-input"
                    disabled={landlordLoading}
                  >
                    <option value="">
                      {landlordLoading ? 'Đang tải...' : '-- Chọn công ty --'}
                    </option>
                    {landlords.map(l => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  {landlordError && (
                    <span style={{color: '#ef4444', fontSize: '0.8rem'}}>{landlordError}</span>
                  )}
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark">Số hợp đồng <span style={{color: '#ef4444'}}>*</span></label>
                  <input
                    type="text"
                    placeholder="HD/000291"
                    className="form-input"
                    readOnly
                  />
                </div>
              </div>

              {/* Row 3 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Mặt bằng thuê <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    name="premises"
                    value={formData.premises}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">24VP,15 (1000m2)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark">Loại xe</label>
                  <select
                    name="vehicleType"
                    value={formData.vehicleType}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Chọn loại xe --</option>
                    {vehicleTypeOptions.map((type) => (
                      <option key={type.id} value={type.id}>
                        {type.name || type.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 4 */}
              <div className="form-input-row">
                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    id="ownershipType"
                    type="checkbox"
                    checked={formData.ownershipType}
                    onChange={(e) => setFormData(prev => ({ ...prev, ownershipType: e.target.checked }))}
                    style={{ width: '16px', height: '16px' }}
                  />
                  <label htmlFor="ownershipType" className="form-label form-label-dark" style={{ margin: 0 }}>
                    Không chính chu
                  </label>
                </div>
              </div>

              {/* Row 4 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{color: '#ef4444'}}>*</span></label>
                  <input
                    type="text"
                    name="userName"
                    value={formData.userName}
                    onChange={handleChange}
                    placeholder="-Nhập-"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
                  <input
                    type="tel"
                    placeholder="-Nhập-"
                    className="form-input"
                  />
                </div>
              </div>

              {/* Row 5 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Biển kiểm soát <span style={{color: '#ef4444'}}>*</span></label>
                  <input
                    type="text"
                    name="licensePlate"
                    value={formData.licensePlate}
                    onChange={handleChange}
                    placeholder="-Chọn-"
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                    <input type="checkbox" style={{width: '16px', height: '16px'}} />
                    <span>Biển số khác</span>
                  </label>
                </div>
              </div>

              {/* Row 6 */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Loại thẻ <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    name="feeConfig"
                    value={formData.feeConfig}
                    onChange={handleChange}
                    className="form-input"
                  >
                    <option value="">-- Chọn loại thẻ --</option>
                    {feeConfigOptions.map((fee) => (
                      <option key={fee.id} value={fee.id}>
                        {fee.name || fee.code}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group" />
              </div>

              {/* Row 7: Hình thức thanh toán */}
              <div className="form-input-row">
                <div className="form-group">
                  <label className="form-label form-label-dark">Hình thức thanh toán <span style={{color: '#ef4444'}}>*</span></label>
                  <select
                    className="form-input"
                  >
                    <option value="">Thanh toán chung</option>
                    <option value="separate">Thanh toán riêng</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label form-label-dark">Ngày đăng ký áp dụng <span style={{color: '#ef4444'}}>*</span></label>
                  <input
                    type="date"
                    name="effectiveDate"
                    value={formData.effectiveDate}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              </div>

              {/* Required documents */}
              <div style={{marginTop: 32, borderTop: '1px solid #e2e8f0', paddingTop: 20}}>
                {requiredDocs.length === 0 ? (
                  <p style={{color: '#64748b', fontSize: '0.95rem'}}>Chọn đầy đủ Đối tượng đăng ký, Hình thức đăng ký và Loại xe để hiển thị danh sách tài liệu cần tải lên.</p>
                ) : requiredDocs.map((doc, index) => {
                  const docId = String(doc.id ?? doc.code ?? index)
                  return (
                    <div
                      key={docId}
                      className="file-upload-row"
                      style={{display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px'}}
                    >
                      <label className="file-label" style={{minWidth: '120px'}}>{doc.name || doc.display_name || doc.code || `Tài liệu ${index + 1}`}</label>
                      {!docFileNames[docId] && (
                        <label htmlFor={`required-doc-${docId}`} className="file-upload-btn">
                          <i className="fa-solid fa-upload" style={{marginRight: '6px'}} /> Tải lên
                        </label>
                      )}
                      <input
                        id={`required-doc-${docId}`}
                        type="file"
                        onChange={(e) => handleRequiredDocFileChange(e, docId)}
                        style={{display: 'none'}}
                      />
                      {docFileNames[docId] && (
                        <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                          <span style={{fontSize: '0.9rem', color: '#0f172a'}}>
                            <i className="fa-solid fa-file" style={{marginRight: '4px'}} />
                            {docFileNames[docId]}
                          </span>
                          {docFiles[docId] && canPreview(docFiles[docId].type) && (
                            <button
                              type="button"
                              onClick={() => openPreview(docFiles[docId])}
                              style={{
                                padding: '4px 8px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                              }}
                            >
                              <i className="fa-solid fa-eye" style={{marginRight: '4px'}} /> Xem
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setDocFileNames(prev => ({ ...prev, [docId]: '' }))
                              setDocFiles(prev => ({ ...prev, [docId]: null }))
                              setDocAttachmentIds(prev => ({ ...prev, [docId]: null }))
                            }}
                            style={{
                              padding: '4px 8px',
                              backgroundColor: '#ef4444',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                            }}
                          >
                            <i className="fa-solid fa-trash" style={{marginRight: '4px'}} /> Xóa
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Action buttons */}
              <div className="form-actions-bottom" style={{marginTop: 40, paddingTop: 20, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, justifyContent: 'flex-end'}}>
                <button
                  type="button"
                  onClick={handleClose}
                  className="secondary-button"
                  style={{width: 'auto', paddingLeft: 24, paddingRight: 24}}
                >
                  <i className="fa-solid fa-ban"></i> Đóng
                </button>
                <button
                  type="submit"
                  className="action-button"
                  style={{width: 'auto', paddingLeft: 24, paddingRight: 24}}
                >
                  <i className="fa-solid fa-floppy-disk"></i> Lưu
                </button>
              </div>
            </form>
          </div>

          {/* Right column: Quota info */}
          <div className="form-right">
            <div style={{marginBottom: 20}}>
              <h3 style={{margin: 0, fontSize: '1rem', fontWeight: 600, color: '#22c55e'}}>Thông tin định mức</h3>
            </div>

            <div className="quota-table">
              <div className="quota-header" style={{background: '#ef4444', color: '#fff'}}>
                <div className="quota-cell">24VP,15 (1000m2)</div>
              </div>
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{background: '#f3f4f6', borderBottom: '1px solid #e5e7eb'}}>
                    <th style={{padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a'}}>Định mức</th>
                    <th style={{padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a'}}>Thực tế</th>
                    <th style={{padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a'}}>Ngoài định mức</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{borderBottom: '1px solid #e5e7eb'}}>
                    <td style={{padding: '12px 16px', color: '#0f172a'}}>Ô tô</td>
                    <td style={{padding: '12px 16px', textAlign: 'center', color: '#0f172a'}}>100</td>
                    <td style={{padding: '12px 16px', textAlign: 'center', color: '#0f172a'}}>55</td>
                  </tr>
                  <tr>
                    <td style={{padding: '12px 16px', color: '#0f172a'}}>Xe máy</td>
                    <td style={{padding: '12px 16px', textAlign: 'center', color: '#0f172a'}}>75</td>
                    <td style={{padding: '12px 16px', textAlign: 'center', color: '#0f172a'}}>30</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{marginTop: 28}}>
              <label className="form-label form-label-dark">Ghi chú</label>
              <textarea
                placeholder="Nhập ghi chú"
                className="form-textarea"
                rows={6}
                style={{minHeight: '140px'}}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
    <FilePreviewModal file={previewFile} onClose={closePreview} />
    </>
  )
}
