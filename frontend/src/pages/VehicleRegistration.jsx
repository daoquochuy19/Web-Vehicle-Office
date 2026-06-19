import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMasterData } from '../hooks/useMasterData'
import FilePreviewModal from '../components/FilePreviewModal'
import { authFetch } from '../utils/authApi'

// Giá trị registrationType từ Odoo selection
const REGISTRATION_TYPE_CHANGE_PLATE = 'change_plate'
const REGISTRATION_TYPE_LOCK_CARD = 'lock_card'
const REGISTRATION_TYPE_UNLOCK_CARD = 'unlock_card'
const REGISTRATION_TYPE_RETURN_CARD = 'return_card'
const REGISTRATION_TYPE_DAMAGED_REISSUE = 'damaged_reissue'
const REGISTRATION_TYPE_LOST_REISSUE = 'lost_reissue'

export default function VehicleRegistration() {
  const navigate = useNavigate()
  const {
    landlords,
    typePartnerOptions,
    registrationTypeOptions,
    vehicleTypeOptions,
    feeConfigOptions,
    loading: masterLoading,
    error: masterError,
  } = useMasterData()

  // --- State form chung ---
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
    phone: '',
    licensePlate: '',
    effectiveDate: '',
    note: '',
  })

  // --- State riêng cho "cấp mới" ---
  const [requiredDocs, setRequiredDocs] = useState([])
  const [docFileNames, setDocFileNames] = useState({})
  const [docFiles, setDocFiles] = useState({})
  const [docAttachmentIds, setDocAttachmentIds] = useState({})
  const [previewFile, setPreviewFile] = useState(null)

  // --- State riêng cho "đổi biển" / "khóa/mở/trả thẻ" ---
  const [oldPlateOptions, setOldPlateOptions] = useState([])
  const [oldPlateLoading, setOldPlateLoading] = useState(false)
  const [oldLicensePlate, setOldLicensePlate] = useState('')
  const [newLicensePlate, setNewLicensePlate] = useState('')
  const [altPlate, setAltPlate] = useState(false)
  const [ownershipLabel, setOwnershipLabel] = useState('')

  // --- State riêng cho "hỏng thẻ / mất thẻ cấp lại" ---
  const [reissueReason, setReissueReason] = useState('')       // lý do hỏng thẻ (chỉ damaged_reissue)
  const [reissueActivationDate, setReissueActivationDate] = useState('') // ngày kích hoạt lần đầu (readonly)
  const [reissueUsageDate, setReissueUsageDate] = useState('') // ngày đăng ký sử dụng
  const [reissueFeeChecked, setReissueFeeChecked] = useState(false)
  const [reissueFeePayment, setReissueFeePayment] = useState('')

  const isChangePlate = formData.registrationType === REGISTRATION_TYPE_CHANGE_PLATE
  const isLockCard = formData.registrationType === REGISTRATION_TYPE_LOCK_CARD
  const isUnlockCard = formData.registrationType === REGISTRATION_TYPE_UNLOCK_CARD
  const isReturnCard = formData.registrationType === REGISTRATION_TYPE_RETURN_CARD
  const isDamagedReissue = formData.registrationType === REGISTRATION_TYPE_DAMAGED_REISSUE
  const isLostReissue = formData.registrationType === REGISTRATION_TYPE_LOST_REISSUE

  // Các mode dùng chung layout đơn cột + dropdown biển xe active
  const isPlateSelectMode = isChangePlate || isLockCard || isUnlockCard || isReturnCard || isDamagedReissue || isLostReissue

  useEffect(() => {
    if (localStorage.getItem('loggedIn') !== 'true') {
      navigate('/', { replace: true })
    }
  }, [navigate])

  // Fetch danh sách biển xe active khi mode đổi biển hoặc khóa thẻ + đã chọn công ty
  useEffect(() => {
    if (!isPlateSelectMode || !formData.company) {
      setOldPlateOptions([])
      return
    }
    async function fetchActivePlates() {
      setOldPlateLoading(true)
      try {
        const res = await authFetch('/api/v1/data/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            queries: [{
              key: 'active_plates',
              model: 'vehicle.card.register',
              fields: ['id', 'license_plate', 'vehicle_type_id', 'is_not_owner'],
              domain: [
                ['registrant_id', '=', Number(formData.company)],
                ['state', 'in', ['active', 'confirmed']],
              ],
              limit: 200,
              offset: 0,
              order: 'license_plate asc',
              depth: 0,
            }],
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setOldPlateOptions(data.result?.DATA?.active_plates ?? [])
      } catch (err) {
        console.error('Fetch active plates error:', err)
        setOldPlateOptions([])
      } finally {
        setOldPlateLoading(false)
      }
    }
    fetchActivePlates()
  }, [isPlateSelectMode, formData.company])

  // Fetch tài liệu yêu cầu (chỉ dùng cho cấp mới)
  const fetchRequiredDocuments = async (data) => {
    if (!data.typePartner || !data.registrationType || !data.vehicleType) {
      setRequiredDocs([])
      setDocFileNames({})
      setDocFiles({})
      setDocAttachmentIds({})
      return
    }
    try {
      const res = await authFetch('/api/v1/rpc/vehicle.card.register/get_required_documents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
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

  const handleChange = (e) => {
    const { name, value } = e.target
    const next = { ...formData, [name]: value }
    setFormData(next)
    if (name === 'typePartner' || name === 'registrationType' || name === 'vehicleType') {
      const noDocsModes = [
        REGISTRATION_TYPE_CHANGE_PLATE,
        REGISTRATION_TYPE_LOCK_CARD,
        REGISTRATION_TYPE_UNLOCK_CARD,
        REGISTRATION_TYPE_RETURN_CARD,
        REGISTRATION_TYPE_DAMAGED_REISSUE,
        REGISTRATION_TYPE_LOST_REISSUE,
      ]
      if (!noDocsModes.includes(next.registrationType)) {
        fetchRequiredDocuments(next)
      } else {
        setRequiredDocs([])
      }
    }
  }

  const handleOldPlateChange = (e) => {
    const value = e.target.value
    const selected = oldPlateOptions.find((p) => String(p.id) === value)
    setOldLicensePlate(value)
    setOwnershipLabel(
      selected ? (selected.is_not_owner ? 'Không chính chủ' : 'Chính chủ') : ''
    )
  }

  const uploadFileToOdoo = async (file) => {
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await authFetch('/api/v1/parking/upload-document', {
        method: 'POST',
        headers: {
        },
        credentials: 'include',
        body: fd,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      return data.result?.DATA?.attachments?.[0]?.id || data.result?.DATA?.id || null
    } catch (err) {
      console.error('Upload document error:', err)
      alert('Tải tài liệu lên thất bại')
      return null
    }
  }

  const handleRequiredDocFileChange = async (e, docId) => {
    const file = e.target.files?.[0]
    if (!file) return
    setDocFileNames((prev) => ({ ...prev, [docId]: file.name }))
    setDocFiles((prev) => ({ ...prev, [docId]: file }))
    const attachmentId = await uploadFileToOdoo(file)
    if (attachmentId) setDocAttachmentIds((prev) => ({ ...prev, [docId]: attachmentId }))
  }

  const canPreview = (mimetype) => {
    if (!mimetype) return false
    if (/^image\//i.test(mimetype)) return true
    if (mimetype === 'application/pdf') return true
    return [
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ].includes(mimetype.toLowerCase())
  }

  const openPreview = (file) => {
    if (!canPreview(file.type)) {
      alert('Không thể xem trước loại file này. Vui lòng tải về để xem.')
      return
    }
    setPreviewFile(file)
  }

  const handleSubmitNew = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const lineDocumentIds = requiredDocs.map((doc, index) => {
      const documentId = doc.document_parking_card_id ?? doc.id ?? doc.code ?? index
      const attachmentKey = String(doc.id ?? doc.code ?? index)
      const attachmentId = docAttachmentIds[attachmentKey]
      return [0, 0, {
        document_parking_card_id: Number(documentId),
        attachment_ids: attachmentId ? [attachmentId] : null,
      }]
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
      note: formData.note,
      date_request: dateRequest,
      date_used: formData.effectiveDate,
      time_return: 16.0,
      time_return_to: 17.0,
      line_document_ids: lineDocumentIds,
    }

    try {
      const res = await authFetch('/api/v1/parking/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[create registration response]', data)
      alert('Phiếu đăng ký đã được tạo thành công')
    } catch (err) {
      console.error('Create registration error:', err)
      alert('Tạo phiếu đăng ký thất bại')
    }
  }

  const handleSubmitChangePlate = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const payload = {
      type_partner: formData.typePartner,
      registration_type: formData.registrationType,
      old_vehicle_card_id: Number(oldLicensePlate),
      license_plate: newLicensePlate,
      registrant_id: Number(formData.company),
      vehicle_user_id: Number(formData.company),
      vehicle_type_id: Number(formData.vehicleType),
      building_house_id: 1718,
      registration_method: 'online',
      is_vip: false,
      is_not_owner: ownershipLabel === 'Không chính chủ',
      is_company_registration: false,
      is_special: false,
      note: formData.note,
      date_request: dateRequest,
      date_used: formData.effectiveDate,
    }

    try {
      const res = await authFetch('/api/v1/parking/change-license-plate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[change license plate response]', data)
      alert('Phiếu đổi biển kiểm soát đã được tạo thành công')
    } catch (err) {
      console.error('Change license plate error:', err)
      alert('Tạo phiếu đổi biển thất bại')
    }
  }

  const handleSubmitLockCard = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const payload = {
      type_partner: formData.typePartner,
      registration_type: formData.registrationType,
      old_vehicle_card_id: Number(oldLicensePlate),
      registrant_id: Number(formData.company),
      vehicle_user_id: Number(formData.company),
      vehicle_type_id: Number(formData.vehicleType),
      building_house_id: 1718,
      registration_method: 'online',
      is_vip: false,
      is_not_owner: ownershipLabel === 'Không chính chủ',
      is_company_registration: false,
      is_special: false,
      note: formData.note,
      date_request: dateRequest,
      date_used: formData.effectiveDate,
    }

    try {
      const res = await authFetch('/api/v1/parking/lock-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[lock card response]', data)
      alert('Phiếu khóa thẻ đã được tạo thành công')
    } catch (err) {
      console.error('Lock card error:', err)
      alert('Tạo phiếu khóa thẻ thất bại')
    }
  }

  const handleSubmitUnlockCard = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const payload = {
      type_partner: formData.typePartner,
      registration_type: formData.registrationType,
      old_vehicle_card_id: Number(oldLicensePlate),
      registrant_id: Number(formData.company),
      vehicle_user_id: Number(formData.company),
      vehicle_type_id: Number(formData.vehicleType),
      building_house_id: 1718,
      registration_method: 'online',
      is_vip: false,
      is_not_owner: ownershipLabel === 'Không chính chủ',
      is_company_registration: false,
      is_special: false,
      note: formData.note,
      date_request: dateRequest,
      date_used: formData.effectiveDate,
    }

    try {
      const res = await authFetch('/api/v1/parking/unlock-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[unlock card response]', data)
      alert('Phiếu mở khóa thẻ đã được tạo thành công')
    } catch (err) {
      console.error('Unlock card error:', err)
      alert('Tạo phiếu mở khóa thẻ thất bại')
    }
  }

  const handleSubmitReturnCard = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const payload = {
      type_partner: formData.typePartner,
      registration_type: formData.registrationType,
      old_vehicle_card_id: Number(oldLicensePlate),
      registrant_id: Number(formData.company),
      vehicle_user_id: Number(formData.company),
      vehicle_type_id: Number(formData.vehicleType),
      building_house_id: 1718,
      registration_method: 'online',
      is_vip: false,
      is_not_owner: ownershipLabel === 'Không chính chủ',
      is_company_registration: false,
      is_special: false,
      note: formData.note,
      date_request: dateRequest,
      date_used: formData.effectiveDate,
    }

    try {
      const res = await authFetch('/api/v1/parking/return-card', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[return card response]', data)
      alert('Phiếu trả thẻ đã được tạo thành công')
    } catch (err) {
      console.error('Return card error:', err)
      alert('Tạo phiếu trả thẻ thất bại')
    }
  }

  const buildReissuePayload = (dateRequest) => ({
    type_partner: formData.typePartner,
    registration_type: formData.registrationType,
    old_vehicle_card_id: Number(oldLicensePlate),
    registrant_id: Number(formData.company),
    vehicle_user_id: Number(formData.company),
    vehicle_type_id: Number(formData.vehicleType),
    building_house_id: 1718,
    registration_method: 'online',
    is_vip: false,
    is_not_owner: ownershipLabel === 'Không chính chủ',
    is_company_registration: false,
    is_special: false,
    note: formData.note,
    date_request: dateRequest,
    date_used: reissueUsageDate,
    is_fee: reissueFeeChecked,
    fee_payment_method: reissueFeePayment,
  })

  const handleSubmitDamagedReissue = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const payload = { ...buildReissuePayload(dateRequest), reason_damaged: reissueReason }
    try {
      const res = await authFetch('/api/v1/parking/damaged-reissue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[damaged reissue response]', data)
      alert('Phiếu hỏng thẻ cấp lại đã được tạo thành công')
    } catch (err) {
      console.error('Damaged reissue error:', err)
      alert('Tạo phiếu hỏng thẻ cấp lại thất bại')
    }
  }

  const handleSubmitLostReissue = async (e) => {
    e.preventDefault()
    const now = new Date()
    const pad = (v) => String(v).padStart(2, '0')
    const dateRequest = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
    const payload = buildReissuePayload(dateRequest)
    try {
      const res = await authFetch('/api/v1/parking/lost-reissue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      console.log('[lost reissue response]', data)
      alert('Phiếu mất thẻ cấp lại đã được tạo thành công')
    } catch (err) {
      console.error('Lost reissue error:', err)
      alert('Tạo phiếu mất thẻ cấp lại thất bại')
    }
  }

  // ─── Shared: 2 row đầu luôn hiển thị ───────────────────────────────────────
  const renderTopRows = () => (
    <>
      <div className="form-input-row">
        <div className="form-group">
          <label className="form-label form-label-dark">Đối tượng đăng ký <span style={{ color: '#ef4444' }}>*</span></label>
          <select name="typePartner" value={formData.typePartner} onChange={handleChange} className="form-input">
            <option value="">-- Chọn đối tượng đăng ký --</option>
            {typePartnerOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label form-label-dark">Hình thức đăng ký <span style={{ color: '#ef4444' }}>*</span></label>
          <select name="registrationType" value={formData.registrationType} onChange={handleChange} className="form-input">
            <option value="">-- Chọn hình thức đăng ký --</option>
            {registrationTypeOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
    </>
  )

  // ─── Shared: Công ty + Số hợp đồng ─────────────────────────────────────────
  const renderCompanyRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Công ty <span style={{ color: '#ef4444' }}>*</span></label>
        <select name="company" value={formData.company} onChange={handleChange} className="form-input" disabled={masterLoading}>
          <option value="">{masterLoading ? 'Đang tải...' : '-- Chọn công ty --'}</option>
          {landlords.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {masterError && <span style={{ color: '#ef4444', fontSize: '0.8rem' }}>{masterError}</span>}
      </div>
      <div className="form-group">
        <label className="form-label form-label-dark">Số hợp đồng <span style={{ color: '#ef4444' }}>*</span></label>
        <input type="text" placeholder="HD/000291" className="form-input" readOnly />
      </div>
    </div>
  )

  // ─── Shared: Mặt bằng thuê + Loại xe ────────────────────────────────────────
  const renderPremisesVehicleRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Mặt bằng thuê <span style={{ color: '#ef4444' }}>*</span></label>
        <select name="premises" value={formData.premises} onChange={handleChange} className="form-input">
          <option value="">24VP,15 (1000m2)</option>
        </select>
      </div>
      <div className="form-group">
        <label className="form-label form-label-dark">Loại xe</label>
        <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="form-input">
          <option value="">-- Chọn loại xe --</option>
          {vehicleTypeOptions.map((t) => (
            <option key={t.id} value={t.id}>{t.name || t.display_name}</option>
          ))}
        </select>
      </div>
    </div>
  )

  // ─── Shared: Họ tên + SĐT ───────────────────────────────────────────────────
  const renderUserRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
        <input type="text" name="userName" value={formData.userName} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
      </div>
      <div className="form-group">
        <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
        <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
      </div>
    </div>
  )

  // ─── Shared: Loại thẻ + Hình thức thanh toán ────────────────────────────────
  const renderFeePaymentRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Loại thẻ <span style={{ color: '#ef4444' }}>*</span></label>
        <select name="feeConfig" value={formData.feeConfig} onChange={handleChange} className="form-input">
          <option value="">-- Chọn loại thẻ --</option>
          {feeConfigOptions.map((fee) => (
            <option key={fee.id} value={fee.id}>{fee.name || fee.code}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label form-label-dark">Hình thức thanh toán <span style={{ color: '#ef4444' }}>*</span></label>
        <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-input">
          <option value="">Thanh toán chung</option>
          <option value="separate">Thanh toán riêng</option>
        </select>
      </div>
    </div>
  )

  // ─── Shared: Ngày đăng ký áp dụng ───────────────────────────────────────────
  const renderEffectiveDateRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Ngày đăng ký áp dụng <span style={{ color: '#ef4444' }}>*</span></label>
        <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="form-input" />
      </div>
      <div className="form-group" />
    </div>
  )

  // ─── Shared: Action buttons ──────────────────────────────────────────────────
  const renderActions = () => (
    <div className="form-actions-bottom" style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #e2e8f0', display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
      <button type="button" onClick={() => navigate('/')} className="secondary-button" style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}>
        <i className="fa-solid fa-ban"></i> Đóng
      </button>
      <button type="submit" className="action-button" style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}>
        <i className="fa-solid fa-floppy-disk"></i> Lưu
      </button>
    </div>
  )

  /**
   * Helper render layout "Hỏng thẻ / Mất thẻ cấp lại".
   * showDamageReason=true → thêm row Lý do hỏng thẻ (chỉ damaged_reissue).
   */
  const renderReissueForm = (onSubmit, showDamageReason = false) => (
    <div className="form-left" style={{ maxWidth: 860, margin: '0 auto' }}>
      <form onSubmit={onSubmit} className="vehicle-registration-form">
        {renderTopRows()}

        {/* Biển kiểm soát — full width */}
        <div className="form-group">
          <label className="form-label form-label-dark">Biển kiểm soát <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={oldLicensePlate}
            onChange={handleOldPlateChange}
            className="form-input"
            disabled={!formData.company || oldPlateLoading}
          >
            <option value="">
              {oldPlateLoading ? 'Đang tải...' : !formData.company ? '-- Chọn công ty trước --' : '-- Chọn biển kiểm soát --'}
            </option>
            {oldPlateOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.license_plate}</option>
            ))}
          </select>
        </div>

        {renderCompanyRow()}

        {/* Mặt bằng thuê — full width */}
        <div className="form-group">
          <label className="form-label form-label-dark">Mặt bằng thuê <span style={{ color: '#ef4444' }}>*</span></label>
          <select name="premises" value={formData.premises} onChange={handleChange} className="form-input">
            <option value="">24VP,15 (1000m2)</option>
          </select>
        </div>

        {/* Loại xe + Loại sở hữu */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Loại xe</label>
            <select name="vehicleType" value={formData.vehicleType} onChange={handleChange} className="form-input">
              <option value="">-- Chọn loại xe --</option>
              {vehicleTypeOptions.map((t) => (
                <option key={t.id} value={t.id}>{t.name || t.display_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Loại sở hữu</label>
            <input
              type="text"
              value={ownershipLabel}
              placeholder="-"
              className="form-input"
              readOnly
              style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'default' }}
            />
          </div>
        </div>

        {/* Họ tên + SĐT */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" name="userName" value={formData.userName} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
          </div>
        </div>

        {/* HTTТ + Loại thẻ */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Hình thức thanh toán <span style={{ color: '#ef4444' }}>*</span></label>
            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-input">
              <option value="">Thanh toán chung</option>
              <option value="separate">Thanh toán riêng</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Loại thẻ <span style={{ color: '#ef4444' }}>*</span></label>
            <select name="feeConfig" value={formData.feeConfig} onChange={handleChange} className="form-input">
              <option value="">-- Chọn loại thẻ --</option>
              {feeConfigOptions.map((fee) => (
                <option key={fee.id} value={fee.id}>{fee.name || fee.code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Ngày kích hoạt lần đầu (readonly) + Ngày đăng ký sử dụng */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Ngày kích hoạt thẻ lần đầu</label>
            <input
              type="text"
              value={reissueActivationDate}
              placeholder="-"
              className="form-input"
              readOnly
              style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'default' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Ngày đăng ký sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
            <input
              type="date"
              value={reissueUsageDate}
              onChange={(e) => setReissueUsageDate(e.target.value)}
              className="form-input"
            />
          </div>
        </div>

        {/* Lý do hỏng thẻ — chỉ hiện với damaged_reissue */}
        {showDamageReason && (
          <div className="form-input-row" style={{ alignItems: 'flex-end' }}>
            <div className="form-group">
              <label className="form-label form-label-dark">Lý do hỏng thẻ <span style={{ color: '#ef4444' }}>*</span></label>
              <select value={reissueReason} onChange={(e) => setReissueReason(e.target.value)} className="form-input">
                <option value="">-- Chọn lý do --</option>
                <option value="hong_tu">Hỏng từ</option>
                <option value="loi_san_xuat">Lỗi sản xuất</option>
                <option value="khac">Khác</option>
              </select>
            </div>
            {/* Thu phí + HTTТ tiền phí */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={reissueFeeChecked}
                  onChange={(e) => setReissueFeeChecked(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
                />
                <span className="form-label form-label-dark" style={{ margin: 0 }}>Thu phí 100.000</span>
              </label>
              <div className="form-group" style={{ flex: 1, gap: 8 }}>
                <label className="form-label form-label-dark">Hình thức thanh toán tiền phí <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  type="text"
                  value={reissueFeePayment}
                  onChange={(e) => setReissueFeePayment(e.target.value)}
                  placeholder="Thanh toán chung"
                  className="form-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Thu phí + HTTТ tiền phí — chỉ hiện với lost_reissue */}
        {!showDamageReason && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', whiteSpace: 'nowrap', paddingBottom: '16px' }}>
              <input
                type="checkbox"
                checked={reissueFeeChecked}
                onChange={(e) => setReissueFeeChecked(e.target.checked)}
                style={{ width: '16px', height: '16px', accentColor: '#ef4444' }}
              />
              <span className="form-label form-label-dark" style={{ margin: 0 }}>Thu phí 100.000</span>
            </label>
            <div className="form-group" style={{ flex: 1, maxWidth: 280, gap: 8 }}>
              <label className="form-label form-label-dark">Hình thức thanh toán tiền phí <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                type="text"
                value={reissueFeePayment}
                onChange={(e) => setReissueFeePayment(e.target.value)}
                placeholder="Thanh toán chung"
                className="form-input"
              />
            </div>
          </div>
        )}

        {/* Ghi chú — full width */}
        <div className="form-group">
          <label className="form-label form-label-dark">Ghi chú</label>
          <textarea name="note" value={formData.note} onChange={handleChange} placeholder="Nhập ghi chú" className="form-textarea" rows={4} style={{ minHeight: '100px' }} />
        </div>

        {renderActions()}
      </form>
    </div>
  )

  /**
   * Helper render layout đơn cột dùng chung cho:
   * unlock_card, return_card (và bất kỳ mode tương tự sau này).
   * Không có dòng cảnh báo.
   */
  const renderSingleColCardForm = (onSubmit) => (
    <div className="form-left" style={{ maxWidth: 860, margin: '0 auto' }}>
      <form onSubmit={onSubmit} className="vehicle-registration-form">
        {renderTopRows()}

        {/* Biển kiểm soát — full width */}
        <div className="form-group">
          <label className="form-label form-label-dark">Biển kiểm soát <span style={{ color: '#ef4444' }}>*</span></label>
          <select
            value={oldLicensePlate}
            onChange={handleOldPlateChange}
            className="form-input"
            disabled={!formData.company || oldPlateLoading}
          >
            <option value="">
              {oldPlateLoading ? 'Đang tải...' : !formData.company ? '-- Chọn công ty trước --' : '-- Chọn biển kiểm soát --'}
            </option>
            {oldPlateOptions.map((p) => (
              <option key={p.id} value={p.id}>{p.license_plate}</option>
            ))}
          </select>
        </div>

        {renderCompanyRow()}
        {renderPremisesVehicleRow()}

        {/* Loại sở hữu + Họ tên */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Loại sở hữu</label>
            <input
              type="text"
              value={ownershipLabel}
              placeholder="-"
              className="form-input"
              readOnly
              style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'default' }}
            />
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="text" name="userName" value={formData.userName} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
          </div>
        </div>

        {/* SĐT + Hình thức thanh toán */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Hình thức thanh toán <span style={{ color: '#ef4444' }}>*</span></label>
            <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-input">
              <option value="">Thanh toán chung</option>
              <option value="separate">Thanh toán riêng</option>
            </select>
          </div>
        </div>

        {/* Loại thẻ + Ngày áp dụng */}
        <div className="form-input-row">
          <div className="form-group">
            <label className="form-label form-label-dark">Loại thẻ <span style={{ color: '#ef4444' }}>*</span></label>
            <select name="feeConfig" value={formData.feeConfig} onChange={handleChange} className="form-input">
              <option value="">-- Chọn loại thẻ --</option>
              {feeConfigOptions.map((fee) => (
                <option key={fee.id} value={fee.id}>{fee.name || fee.code}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label form-label-dark">Ngày đăng ký áp dụng <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="form-input" />
          </div>
        </div>

        {/* Ghi chú — full width */}
        <div className="form-group">
          <label className="form-label form-label-dark">Ghi chú</label>
          <textarea name="note" value={formData.note} onChange={handleChange} placeholder="Nhập ghi chú" className="form-textarea" rows={4} style={{ minHeight: '100px' }} />
        </div>

        {renderActions()}
      </form>
    </div>
  )

  return (
    <>
      <main className="page-shell vehicle-registration-shell-no-bg">
        <section className="registration-form-container">
          <h2>Thông tin phiếu đăng ký</h2>

          {/* ── LAYOUT: đổi biển → đơn cột, cấp mới → 2 cột ── */}
          {isChangePlate ? (

            /* ════════════ VIEW ĐỔI BIỂN ════════════ */
            <div className="form-left" style={{ maxWidth: 860, margin: '0 auto' }}>
              <form onSubmit={handleSubmitChangePlate} className="vehicle-registration-form">
                {renderTopRows()}

                {/* Biển kiểm soát cũ — full width */}
                <div className="form-group">
                  <label className="form-label form-label-dark">Biển kiểm soát cũ <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={oldLicensePlate}
                    onChange={handleOldPlateChange}
                    className="form-input"
                    disabled={!formData.company || oldPlateLoading}
                  >
                    <option value="">
                      {oldPlateLoading ? 'Đang tải...' : !formData.company ? '-- Chọn công ty trước --' : '-- Chọn biển kiểm soát cũ --'}
                    </option>
                    {oldPlateOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.license_plate}</option>
                    ))}
                  </select>
                </div>

                {/* Biển mới + Biển số khác */}
                <div className="form-input-row" style={{ alignItems: 'flex-end' }}>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Biển kiểm soát mới <span style={{ color: '#ef4444' }}>*</span></label>
                    <input
                      type="text"
                      value={newLicensePlate}
                      onChange={(e) => setNewLicensePlate(e.target.value)}
                      placeholder="-Nhập-"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', paddingBottom: '16px' }}>
                      <input type="checkbox" checked={altPlate} onChange={(e) => setAltPlate(e.target.checked)} style={{ width: '16px', height: '16px' }} />
                      <span className="form-label form-label-dark" style={{ margin: 0 }}>Biển số khác</span>
                    </label>
                  </div>
                </div>

                {renderCompanyRow()}
                {renderPremisesVehicleRow()}

                {/* Loại sở hữu + Họ tên */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Loại sở hữu</label>
                    <input
                      type="text"
                      value={ownershipLabel}
                      placeholder="-"
                      className="form-input"
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'default' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" name="userName" value={formData.userName} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
                  </div>
                </div>

                {/* SĐT + Hình thức thanh toán */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Hình thức thanh toán <span style={{ color: '#ef4444' }}>*</span></label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-input">
                      <option value="">Thanh toán chung</option>
                      <option value="separate">Thanh toán riêng</option>
                    </select>
                  </div>
                </div>

                {/* Loại thẻ + Ngày áp dụng */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Loại thẻ <span style={{ color: '#ef4444' }}>*</span></label>
                    <select name="feeConfig" value={formData.feeConfig} onChange={handleChange} className="form-input">
                      <option value="">-- Chọn loại thẻ --</option>
                      {feeConfigOptions.map((fee) => (
                        <option key={fee.id} value={fee.id}>{fee.name || fee.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Ngày đăng ký áp dụng <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="form-input" />
                  </div>
                </div>

                {/* Ghi chú — full width */}
                <div className="form-group">
                  <label className="form-label form-label-dark">Ghi chú</label>
                  <textarea name="note" value={formData.note} onChange={handleChange} placeholder="Nhập ghi chú" className="form-textarea" rows={4} style={{ minHeight: '100px' }} />
                </div>

                {renderActions()}
              </form>
            </div>

          ) : isLockCard ? (

            /* ════════════ VIEW KHÓA THẺ ════════════ */
            <div className="form-left" style={{ maxWidth: 860, margin: '0 auto' }}>
              <form onSubmit={handleSubmitLockCard} className="vehicle-registration-form">
                {renderTopRows()}

                {/* Biển kiểm soát — full width */}
                <div className="form-group">
                  <label className="form-label form-label-dark">Biển kiểm soát <span style={{ color: '#ef4444' }}>*</span></label>
                  <select
                    value={oldLicensePlate}
                    onChange={handleOldPlateChange}
                    className="form-input"
                    disabled={!formData.company || oldPlateLoading}
                  >
                    <option value="">
                      {oldPlateLoading ? 'Đang tải...' : !formData.company ? '-- Chọn công ty trước --' : '-- Chọn biển kiểm soát --'}
                    </option>
                    {oldPlateOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.license_plate}</option>
                    ))}
                  </select>
                </div>

                {renderCompanyRow()}
                {renderPremisesVehicleRow()}

                {/* Loại sở hữu + Họ tên */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Loại sở hữu</label>
                    <input
                      type="text"
                      value={ownershipLabel}
                      placeholder="-"
                      className="form-input"
                      readOnly
                      style={{ backgroundColor: '#f8fafc', color: '#64748b', cursor: 'default' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Họ tên người sử dụng <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="text" name="userName" value={formData.userName} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
                  </div>
                </div>

                {/* SĐT + Hình thức thanh toán */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Số điện thoại người sử dụng</label>
                    <input type="tel" name="phone" value={formData.phone} onChange={handleChange} placeholder="-Nhập-" className="form-input" />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Hình thức thanh toán <span style={{ color: '#ef4444' }}>*</span></label>
                    <select name="paymentMethod" value={formData.paymentMethod} onChange={handleChange} className="form-input">
                      <option value="">Thanh toán chung</option>
                      <option value="separate">Thanh toán riêng</option>
                    </select>
                  </div>
                </div>

                {/* Loại thẻ + Ngày áp dụng */}
                <div className="form-input-row">
                  <div className="form-group">
                    <label className="form-label form-label-dark">Loại thẻ <span style={{ color: '#ef4444' }}>*</span></label>
                    <select name="feeConfig" value={formData.feeConfig} onChange={handleChange} className="form-input">
                      <option value="">-- Chọn loại thẻ --</option>
                      {feeConfigOptions.map((fee) => (
                        <option key={fee.id} value={fee.id}>{fee.name || fee.code}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label form-label-dark">Ngày đăng ký áp dụng <span style={{ color: '#ef4444' }}>*</span></label>
                    <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} className="form-input" />
                  </div>
                </div>

                {/* Ghi chú — full width */}
                <div className="form-group">
                  <label className="form-label form-label-dark">Ghi chú</label>
                  <textarea name="note" value={formData.note} onChange={handleChange} placeholder="Nhập ghi chú" className="form-textarea" rows={4} style={{ minHeight: '100px' }} />
                </div>

                {/* Cảnh báo */}
                <p style={{ color: '#ef4444', fontWeight: 600, textAlign: 'center', margin: '8px 0 0' }}>
                  Thời hạn khóa thẻ tối đa là 30 ngày! Vui lòng mở khóa thẻ trước khi hết hạn.
                </p>

                {renderActions()}
              </form>
            </div>

          ) : isUnlockCard ? (

            /* ════════════ VIEW MỞ THẺ ════════════ */
            renderSingleColCardForm(handleSubmitUnlockCard)

          ) : isReturnCard ? (

            /* ════════════ VIEW TRẢ THẺ ════════════ */
            renderSingleColCardForm(handleSubmitReturnCard)

          ) : isDamagedReissue ? (

            /* ════════════ VIEW HỎNG THẺ CẤP LẠI ════════════ */
            renderReissueForm(handleSubmitDamagedReissue, true)

          ) : isLostReissue ? (

            /* ════════════ VIEW MẤT THẺ CẤP LẠI ════════════ */
            renderReissueForm(handleSubmitLostReissue, false)

          ) : (

            /* ════════════ VIEW CẤP MỚI ════════════ */
            <div className="form-layout-2col">
              <div className="form-left">
                <form onSubmit={handleSubmitNew} className="vehicle-registration-form">
                  {renderTopRows()}
                  {renderCompanyRow()}
                  {renderPremisesVehicleRow()}
                  {renderUserRow()}

                  {/* Biển kiểm soát + Biển số khác + Không chính chủ */}
                  <div className="form-input-row">
                    <div className="form-group">
                      <label className="form-label form-label-dark">Biển kiểm soát <span style={{ color: '#ef4444' }}>*</span></label>
                      <input type="text" name="licensePlate" value={formData.licensePlate} onChange={handleChange} placeholder="-Chọn-" className="form-input" />
                    </div>
                    <div className="form-group" style={{ justifyContent: 'flex-end', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: 0 }}>
                        <input type="checkbox" style={{ width: '16px', height: '16px' }} />
                        <span className="form-label form-label-dark" style={{ margin: 0 }}>Biển số khác</span>
                      </label>
                      <label htmlFor="ownershipType" style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                        <input
                          id="ownershipType"
                          type="checkbox"
                          checked={formData.ownershipType}
                          onChange={(e) => setFormData((prev) => ({ ...prev, ownershipType: e.target.checked }))}
                          style={{ width: '16px', height: '16px' }}
                        />
                        <span className="form-label form-label-dark" style={{ margin: 0 }}>Không chính chủ</span>
                      </label>
                    </div>
                  </div>

                  {renderFeePaymentRow()}
                  {renderEffectiveDateRow()}

                  {/* Tài liệu yêu cầu */}
                  <div style={{ marginTop: 32, borderTop: '1px solid #e2e8f0', paddingTop: 20 }}>
                    {requiredDocs.length === 0 ? (
                      <p style={{ color: '#64748b', fontSize: '0.95rem' }}>Chọn đầy đủ Đối tượng đăng ký, Hình thức đăng ký và Loại xe để hiển thị danh sách tài liệu cần tải lên.</p>
                    ) : requiredDocs.map((doc, index) => {
                      const docId = String(doc.id ?? doc.code ?? index)
                      return (
                        <div key={docId} className="file-upload-row" style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                          <label className="file-label" style={{ minWidth: '120px' }}>{doc.name || doc.display_name || doc.code || `Tài liệu ${index + 1}`}</label>
                          {!docFileNames[docId] && (
                            <label htmlFor={`required-doc-${docId}`} className="file-upload-btn">
                              <i className="fa-solid fa-upload" style={{ marginRight: '6px' }} /> Tải lên
                            </label>
                          )}
                          <input id={`required-doc-${docId}`} type="file" onChange={(e) => handleRequiredDocFileChange(e, docId)} style={{ display: 'none' }} />
                          {docFileNames[docId] && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                                <i className="fa-solid fa-file" style={{ marginRight: '4px' }} />{docFileNames[docId]}
                              </span>
                              {docFiles[docId] && canPreview(docFiles[docId].type) && (
                                <button type="button" onClick={() => openPreview(docFiles[docId])}
                                  style={{ padding: '4px 8px', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                  <i className="fa-solid fa-eye" style={{ marginRight: '4px' }} /> Xem
                                </button>
                              )}
                              <button type="button"
                                onClick={() => {
                                  setDocFileNames((prev) => ({ ...prev, [docId]: '' }))
                                  setDocFiles((prev) => ({ ...prev, [docId]: null }))
                                  setDocAttachmentIds((prev) => ({ ...prev, [docId]: null }))
                                }}
                                style={{ padding: '4px 8px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <i className="fa-solid fa-trash" style={{ marginRight: '4px' }} /> Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  {renderActions()}
                </form>
              </div>

              {/* Cột phải: Thông tin định mức */}
              <div className="form-right">
                <div style={{ marginBottom: 20 }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: '#22c55e' }}>Thông tin định mức</h3>
                </div>
                <div className="quota-table">
                  <div className="quota-header" style={{ background: '#ef4444', color: '#fff' }}>
                    <div className="quota-cell">24VP,15 (1000m2)</div>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f3f4f6', borderBottom: '1px solid #e5e7eb' }}>
                        <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Định mức</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Thực tế</th>
                        <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.9rem', color: '#0f172a' }}>Ngoài định mức</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        <td style={{ padding: '12px 16px', color: '#0f172a' }}>Ô tô</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0f172a' }}>100</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0f172a' }}>55</td>
                      </tr>
                      <tr>
                        <td style={{ padding: '12px 16px', color: '#0f172a' }}>Xe máy</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0f172a' }}>75</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center', color: '#0f172a' }}>30</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: 28 }}>
                  <label className="form-label form-label-dark">Ghi chú</label>
                  <textarea placeholder="Nhập ghi chú" className="form-textarea" rows={6} style={{ minHeight: '140px' }} />
                </div>
              </div>
            </div>
          )}

        </section>
      </main>
      <FilePreviewModal file={previewFile} onClose={() => setPreviewFile(null)} />
    </>
  )
}
