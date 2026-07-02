import React, { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMasterData } from '../hooks/useMasterData'
import { authFetch } from '../utils/authApi'
import * as XLSX from 'xlsx'
import logoImg from '../assets/images/hapulico-logo.jpg'


// Giá trị registrationType từ Odoo selection
const REGISTRATION_TYPE_CHANGE_PLATE = 'change_plate'
const REGISTRATION_TYPE_LOCK_CARD = 'lock_card'
const REGISTRATION_TYPE_UNLOCK_CARD = 'unlock_card'
const REGISTRATION_TYPE_RETURN_CARD = 'return_card'
const REGISTRATION_TYPE_DAMAGED_REISSUE = 'damaged_reissue'
const REGISTRATION_TYPE_LOST_REISSUE = 'lost_reissue'

export default function VehicleRegistration() {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    navigate('/');
  };

  const {
    landlords,
    typePartnerOptions,
    registrationTypeOptions,
    vehicleTypeOptions,
    contractApartments,
    buidingHouse,
    fleetVehicleModelBrand,
    paymentTypeOptions,
    loading: masterLoading,
    error: masterError,
  } = useMasterData()

  // --- Get mode from navigation state ---
  const mode = location.state?.mode || 'manual'
  const selectedRecord = location.state?.selectedRecord || null
  const isViewMode = !!selectedRecord

  // --- State form chung ---
  const [formData, setFormData] = useState({
    typePartner: 'office',
    registrationType: '',
    company: '',
    premises: '',
    vehicleType: '',
    feeConfig: '',
    paymentMethod: '',
    userName: '',
    phone: '',
    licensePlate: '',
    effectiveDate: '',
    note: '',
    contract: '',
    buidingHouse: '',
  })

  // --- State riêng cho "cấp mới" ---
  const [requiredDocs, setRequiredDocs] = useState([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docFileNames, setDocFileNames] = useState({})
  const [docFiles, setDocFiles] = useState({})
  const [docAttachmentIds, setDocAttachmentIds] = useState({})

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

  // --- State riêng cho Upload Excel ---
  const [activeTab, setActiveTab] = useState(mode === 'excel' ? 'upload' : null)
  const [excelFile, setExcelFile] = useState(null)
  const [excelFileName, setExcelFileName] = useState('')
  const [parsedData, setParsedData] = useState([])
  const [filterType, setFilterType] = useState('valid')
  const [manualRow, setManualRow] = useState({
    name: '',
    phone: '',
    licensePlate: '',
    vehicleType: '',
    brand: '',
    parkingThirtyMin: '',
    paymentMethod: '',
  })
  const [showManualRow, setShowManualRow] = useState(false)
  const [editingRowId, setEditingRowId] = useState(null)
  const [tempRowData, setTempRowData] = useState({})
  const editingRowRef = useRef(null)
  const [allocationInfo, setAllocationInfo] = useState(null)
  const [allocationLoading, setAllocationLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(10)

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

  // Populate form with selected record data when available
  useEffect(() => {
    if (selectedRecord) {
      setFormData(prev => ({
        ...prev,
        registrationType: selectedRecord.registration_type?.key || '',
        company: selectedRecord.company_id?.id || '',
        contract: selectedRecord.contract_id?.id || '',
        buidingHouse: selectedRecord.house_id?.id || '',
        effectiveDate: selectedRecord.date_request?.split(' ')[0] || '',
        note: selectedRecord.note || ''
      }))

      // Populate allocation info from the record
      if (selectedRecord.allocation) {
        const alloc = selectedRecord.allocation;
        setAllocationInfo({
          allocation_car_quota: alloc.allocation_car_quota ?? alloc.car_quota ?? 0,
          allocation_car_actual: alloc.allocation_car_actual ?? alloc.car_actual ?? 0,
          allocation_car_pending: alloc.allocation_car_pending ?? alloc.car_pending ?? 0,
          allocation_car_exceeded: alloc.allocation_car_exceeded ?? alloc.car_exceeded ?? 0,
          allocation_motorbike_quota: alloc.allocation_motorbike_quota ?? alloc.motorbike_quota ?? 0,
          allocation_motorbike_actual: alloc.allocation_motorbike_actual ?? alloc.motorbike_actual ?? 0,
          allocation_motorbike_pending: alloc.allocation_motorbike_pending ?? alloc.motorbike_pending ?? 0,
          allocation_motorbike_exceeded: alloc.allocation_motorbike_exceeded ?? alloc.motorbike_exceeded ?? 0,
          is_exceeded_quota: alloc.is_exceeded_quota ?? false,
        });
      }

      // Populate line items
      if (selectedRecord.line_register_ids && Array.isArray(selectedRecord.line_register_ids)) {
        const lines = selectedRecord.line_register_ids.map((line, index) => ({
          id: `${Date.now()}-${index}`,
          stt: index + 1,
          name: line.registrant_id?.name || '',
          phone: line.phone_number || '',
          licensePlate: line.license_plate || '',
          vehicleType: line.vehicle_type_id?.name || '',
          brand: line.brand_id?.name || '',
          parkingThirtyMin: (line.x_is_free_exit_30min || line.is_parking_30_min) ? 'Có' : 'Không',
          paymentMethod: '',
          isValid: true,
          errors: []
        }))
        setParsedData(lines)
      }
    }
  }, [selectedRecord])

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
        setOldPlateOptions([])
      } finally {
        setOldPlateLoading(false)
      }
    }
    fetchActivePlates()
  }, [isPlateSelectMode, formData.company])

  // Fetch allocation info khi điền đầy đủ các trường trong Excel view (chỉ gọi khi tạo mới, không gọi khi đang xem chi tiết)
  useEffect(() => {
    if (mode === 'excel' && !isViewMode) {
      fetchAllocationInfo(formData)
    }
  }, [mode, isViewMode, formData.registrationType, formData.company, formData.contract, formData.buidingHouse])

  // Fetch thông tin định mức (dùng cho Excel import)
  const fetchAllocationInfo = async (data) => {
    if (!data.registrationType || !data.company || !data.contract || !data.buidingHouse) {
      setAllocationInfo(null)
      setAllocationLoading(false)
      return
    }

    const conditions = {
      registration_type: data.registrationType,
      house_id: Number(data.buidingHouse),
      contract_id: Number(data.contract),
    }
    setAllocationLoading(true)
    try {
      const res = await authFetch('/api/v1/rpc/office.parking/get_allocation_info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          args: [],
          kwargs: { conditions },
        }),
      })
      if (!res.ok) {
        const errorBody = await res.text()
        console.error('get_allocation_info failed', res.status, errorBody)
        throw new Error(`HTTP ${res.status}`)
      }
      const response = await res.json()
      const result = response.result?.DATA || response.DATA || null
      setAllocationInfo(result)
    } catch (err) {
      console.error('Fetch allocation info error:', err)
      setAllocationInfo(null)
    } finally {
      setAllocationLoading(false)
    }
  }

  // Fetch tài liệu yêu cầu (chỉ dùng cho cấp mới)
  const fetchRequiredDocuments = async (data) => {
    if (!data.registrationType) {
      setRequiredDocs([])
      setDocFileNames({})
      setDocFiles({})
      setDocAttachmentIds({})
      setDocsLoading(false)
      return
    }

    const conditions = {
      type_partner: data.typePartner || 'office',
      registration_type: data.registrationType,
      is_vip: false,
      is_not_owner: false,
      ...(data.vehicleType ? { vehicle_type_id: Number(data.vehicleType) } : {}),
    }
    setDocsLoading(true)
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
          kwargs: { conditions },
        }),
      })
      if (!res.ok) {
        const errorBody = await res.text()
        console.error('get_required_documents failed', res.status, errorBody)
        throw new Error(`HTTP ${res.status}`)
      }
      const response = await res.json()
      console.debug('get_required_documents response', response)
      const result = response.result?.DATA || response.DATA || []
      setRequiredDocs(result)
      setDocFileNames({})
      setDocFiles({})
      setDocAttachmentIds({})
    } catch (err) {
      console.error('Fetch required documents error:', err)
      setRequiredDocs([])
    } finally {
      setDocsLoading(false)
    }
  }

  const handleDownloadTemplate = (e) => {
    e.preventDefault();
    const ws_data = [
      ['STT', 'Tên nhân viên', 'Số điện thoại', 'Biển kiểm soát', 'Loại xe', 'Hãng xe', 'Xe gửi 30 phút', 'Hình thức thanh toán'],
      [1, 'Nguyễn Văn A', '0981524563', '29A-12345', 'Ô tô', 'Toyota', 'Có', 'Thanh toán chung']
    ];
    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_CapMoi.xlsx");
  };

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
      const isNoDocsMode = noDocsModes.includes(next.registrationType)
      const hasRegistrationType = Boolean(next.registrationType)
      if (hasRegistrationType && !isNoDocsMode) {
        // Chỉ gọi API khi đã chọn hình thức và không phải mode không cần tài liệu
        fetchRequiredDocuments(next)
      } else {
        setRequiredDocs([])
      }
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 50 * 1024 * 1024) {
      alert("Kích thước file vượt quá 50MB");
      return;
    }

    setExcelFile(file);
    setExcelFileName(file.name);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (data.length === 0) {
        alert("File không có dữ liệu");
        return;
      }

      const headers = data[0].map(h => typeof h === 'string' ? h.trim() : h);
      const expectedHeaders = ['STT', 'Tên nhân viên', 'Số điện thoại', 'Biển kiểm soát', 'Loại xe', 'Hãng xe', 'Xe gửi 30 phút', 'Hình thức thanh toán'];

      const isFormatValid = expectedHeaders.every((h, i) => headers[i] === h);
      if (!isFormatValid) {
        alert("Định dạng file không đúng với file mẫu. Vui lòng tải file mẫu và thử lại.");
        return;
      }

      const rows = [];

      for (let i = 1; i < data.length; i++) {
        const row = data[i];
        if (!row || row.length === 0) continue;

        if (!row[1] && !row[2] && !row[3] && !row[4] && !row[5] && !row[6] && !row[7]) continue;

        const record = {
          name: row[1] || '',
          phone: row[2] || '',
          licensePlate: row[3] || '',
          vehicleType: row[4] || '',
          brand: row[5] || '',
          parkingThirtyMin: row[6] || '',
          paymentMethod: row[7] || '',
          isValid: true,
          errors: [],
        };

        if (!record.name) {
          record.isValid = false;
          record.errors.push('Thiếu "Tên nhân viên"');
        }
        if (!record.licensePlate) {
          record.isValid = false;
          record.errors.push('Thiếu "Biển kiểm soát"');
        }
        if (!record.vehicleType) {
          record.isValid = false;
          record.errors.push('Thiếu "Loại xe"');
        }
        if (!record.paymentMethod) {
          record.isValid = false;
          record.errors.push('Thiếu "Hình thức thanh toán"');
        }

        rows.push(record);
      }

      setParsedData(prev => {
        const existingPlates = new Set(prev.filter(r => r.licensePlate).map(r => r.licensePlate));
        const nextRows = rows.map((record, index) => {
          const next = {
            ...record,
            id: `${Date.now()}-${index}-${Math.random()}`,
            stt: prev.length + index + 1,
            errors: [...record.errors],
          };
          if (next.licensePlate && existingPlates.has(next.licensePlate)) {
            if (!next.errors.includes('Biển kiểm soát đã tồn tại')) {
              next.errors.push('Biển kiểm soát đã tồn tại');
            }
            next.isValid = false;
          }
          existingPlates.add(next.licensePlate);
          return next;
        });
        return [...prev, ...nextRows];
      });
      setActiveTab('check');
    };
    reader.readAsBinaryString(file);
  };

  const handleManualRowChange = (e) => {
    const { name, value } = e.target
    setManualRow(prev => ({ ...prev, [name]: value }))
  }

  const addManualRow = () => {
    const row = {
      stt: parsedData.length + 1,
      name: manualRow.name.trim(),
      phone: manualRow.phone.trim(),
      licensePlate: manualRow.licensePlate.trim(),
      vehicleType: manualRow.vehicleType.trim(),
      brand: manualRow.brand.trim(),
      parkingThirtyMin: manualRow.parkingThirtyMin,
      paymentMethod: manualRow.paymentMethod.trim(),
      isValid: true,
      errors: [],
    }

    if (!row.name) row.errors.push('Thiếu "Tên nhân viên"')
    if (!row.licensePlate) row.errors.push('Thiếu "Biển kiểm soát"')
    if (!row.vehicleType) row.errors.push('Thiếu "Loại xe"')
    if (!row.paymentMethod) row.errors.push('Thiếu "Hình thức thanh toán"')

    const duplicatePlate = parsedData.some(d => d.licensePlate === row.licensePlate)
    if (row.licensePlate && duplicatePlate) {
      row.errors.push('Biển kiểm soát đã tồn tại')
    }

    if (row.errors.length > 0) {
      row.isValid = false
    }

    const rowWithId = {
      ...row,
      id: `${Date.now()}-${Math.random()}`,
    }

    setParsedData(prev => [...prev, rowWithId])
    setManualRow({
      name: '',
      phone: '',
      licensePlate: '',
      vehicleType: '',
      brand: '',
      parkingThirtyMin: '',
      paymentMethod: '',
    })
  }

  const validCount = parsedData.filter(d => d.isValid).length;
  const invalidCount = parsedData.filter(d => !d.isValid).length;
  const showErrorColumn = filterType !== 'valid';

  const filteredData = parsedData.filter(d => {
    if (filterType === 'all') return true;
    if (filterType === 'valid') return d.isValid;
    if (filterType === 'invalid') return !d.isValid;
    return true;
  });

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const displayedData = filteredData.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (e) => {
    const newItemsPerPage = parseInt(e.target.value);
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [filterType]);

  const removeRow = (id) => {
    setParsedData(prev => prev.filter(row => row.id !== id).map((row, idx) => ({ ...row, stt: idx + 1 })));
  }

  const startEditRow = (row) => {
    setEditingRowId(row.id)
    setTempRowData({ ...row })
  }

  const cancelEditRow = () => {
    setEditingRowId(null)
    setTempRowData({})
  }

  const handleTempRowChange = (field, value) => {
    setTempRowData(prev => ({ ...prev, [field]: value }))
  }

  const validateRow = (row) => {
    const errors = []
    if (!row.name) errors.push('Thiếu "Tên nhân viên"')
    if (!row.licensePlate) errors.push('Thiếu "Biển kiểm soát"')
    if (!row.vehicleType) errors.push('Thiếu "Loại xe"')
    if (!row.paymentMethod) errors.push('Thiếu "Hình thức thanh toán"')

    const duplicate = parsedData.some(r => r.id !== row.id && r.licensePlate === row.licensePlate)
    if (duplicate) errors.push('Biển kiểm soát đã tồn tại')

    return {
      ...row,
      isValid: errors.length === 0,
      errors: errors
    }
  }

  const saveEditRow = () => {
    const validatedRow = validateRow(tempRowData)
    setParsedData(prev => prev.map(row =>
      row.id === editingRowId ? validatedRow : row
    ))
    setEditingRowId(null)
    setTempRowData({})
  }



  useEffect(() => {
    const handleClickOutside = (event) => {
      if (editingRowId && editingRowRef.current && !editingRowRef.current.contains(event.target)) {
        saveEditRow()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [editingRowId, tempRowData])

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
      console.log('Upload document response:', data)
      const attachmentId =
        data.result?.DATA?.attachments?.[0]?.id ||
        data.result?.DATA?.attachment_id ||
        data.result?.attachments?.[0]?.id ||
        data.result?.attachment_id ||
        data.result?.id ||
        data.attachment_id ||
        data.id ||
        null
      return attachmentId
    } catch (err) {
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
      alert('Phiếu đổi biển kiểm soát đã được tạo thành công')
    } catch (err) {
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
      alert('Phiếu khóa thẻ đã được tạo thành công')
    } catch (err) {
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
      alert('Phiếu mở khóa thẻ đã được tạo thành công')
    } catch (err) {
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
      alert('Phiếu trả thẻ đã được tạo thành công')
    } catch (err) {
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
      alert('Phiếu hỏng thẻ cấp lại đã được tạo thành công')
    } catch (err) {
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
      alert('Phiếu mất thẻ cấp lại đã được tạo thành công')
    } catch (err) {
      alert('Tạo phiếu mất thẻ cấp lại thất bại')
    }
  }

  const handleSubmitExcel = async () => {
    // Validate form data
    if (!formData.registrationType) {
      alert('Vui lòng chọn Hình thức đăng ký')
      return
    }
    if (!formData.effectiveDate) {
      alert('Vui lòng chọn Ngày đăng ký sử dụng')
      return
    }
    if (!formData.company) {
      alert('Vui lòng chọn Tên công ty')
      return
    }
    if (!formData.contract) {
      alert('Vui lòng chọn Số hợp đồng')
      return
    }
    if (!formData.buidingHouse) {
      alert('Vui lòng chọn Mặt bằng thuê')
      return
    }
    // Get valid rows only
    const validRows = parsedData.filter(d => d.isValid)
    if (validRows.length === 0) {
      alert('Không có dữ liệu hợp lệ để lưu')
      return
    }
    // Build payload
    const lineRegisterIds = validRows.map(row => ({
      license_plate: row.licensePlate,
      registrant_name: row.name,
      phone_number: row.phone,
      vehicle_type_name: row.vehicleType,
      brand_name: row.brand,
      x_is_free_exit_30min: row.parkingThirtyMin === 'Có',
      is_approved: false,
      rejection_reason: ''
    }))
    const payload = {
      registration_type: formData.registrationType,
      registration_method: 'online',
      house_id: Number(formData.buidingHouse),
      contract_id: Number(formData.contract),
      company_id: Number(formData.company),
      date_request: formData.effectiveDate,
      line_register_ids: lineRegisterIds
    }
    console.log('Payload being sent:', payload)
    try {
      const res = await authFetch('/api/v1/office-parking', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })
      let data
      try {
        data = await res.json()
        console.log('Response data (JSON):', data)
      } catch (jsonErr) {
        const textData = await res.text()
        console.log('Response data (Text):', textData)
        data = textData
      }
      if (!res.ok) {
        console.error('Error response:', data)
        const errorMsg = data?.result?.MESSAGE || data?.message || `HTTP ${res.status}`
        throw new Error(errorMsg)
      }
      // Check if business logic error (even with 200 status)
      const businessResult = data?.result
      if (businessResult && businessResult.RESULT === 'ERROR') {
        console.error('Business error:', businessResult)
        throw new Error(businessResult.MESSAGE || 'Lỗi không xác định')
      }
      alert('Dữ liệu đã được lưu thành công')
      navigate('/my/menu')
    } catch (err) {
      console.error('Error saving data:', err)
      alert(`Lưu dữ liệu thất bại: ${err.message || 'Vui lòng thử lại'}`)
    }
  }

  // ─── Shared: 2 row đầu luôn hiển thị ───────────────────────────────────────
  const renderTopRows = () => (
    <>
      <div className="form-input-row">
        <div className="form-group">
          <label className="form-label form-label-dark">Đối tượng đăng ký</label>
          <select name="typePartner" value={formData.typePartner} disabled className="form-input" style={{ backgroundColor: '#f3f4f6', cursor: 'not-allowed' }}>
            {typePartnerOptions.map((o) => {
              const val = o.value || o[0];
              const lbl = o.label || o[1];
              return <option key={val} value={val}>{lbl}</option>;
            })}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label form-label-dark">Hình thức đăng ký <span style={{ color: '#ef4444' }}>*</span></label>
          <select name="registrationType" value={formData.registrationType} onChange={handleChange} className="form-input">
            <option value="">-- Chọn hình thức đăng ký --</option>
            {registrationTypeOptions.map((o) => {
              const val = o.value || o[0];
              const lbl = o.label || o[1];
              return <option key={val} value={val}>{lbl}</option>;
            })}
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
        <select name="contract" value={formData.contract} onChange={handleChange} className="form-input" disabled={masterLoading}>
          <option value="">{masterLoading ? 'Đang tải...' : '-- Chọn số hợp đồng --'}</option>
          {contractApartments.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>
    </div>
  )

  // ─── Shared: Mặt bằng thuê + Loại xe ────────────────────────────────────────
  const renderPremisesVehicleRow = () => (
    <div className="form-input-row">
      <div className="form-group">
        <label className="form-label form-label-dark">Mặt bằng thuê <span style={{ color: '#ef4444' }}>*</span></label>
        <select name="buidingHouse" value={formData.buidingHouse} onChange={handleChange} className="form-input">
          <option value="">{masterLoading ? 'Đang tải...' : '-- Chọn mặt bằng --'}</option>
          {buidingHouse.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
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
      <button type="button" onClick={() => navigate('/my/menu')} className="secondary-button" style={{ width: 'auto', paddingLeft: 24, paddingRight: 24 }}>
        <i className="fa-solid fa-arrow-left"></i> Đóng
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
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-logo">
          <img src={logoImg} alt="Hapulico Logo" />
        </div>
        <nav className="dashboard-nav">
          <div
            className="dashboard-nav-item active">
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-car"></i>
            </div>
            <span>Thẻ xe</span>
          </div>
          <div className="dashboard-nav-item disabled">
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <span>Chi phí</span>
          </div>
          <div className="dashboard-nav-item disabled">
            <div className="dashboard-nav-item-icon">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <span>Ca làm việc</span>
          </div>
        </nav>
      </aside>
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <button className="back-button" onClick={() => navigate('/my/menu')}>
              <i className="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 className="dashboard-header-title">Thông tin phiếu đăng ký</h1>
            </div>
          </div>
          <div className="dashboard-header-right">
            <button className="logout-btn" onClick={handleLogout}>
              <i className="fa-solid fa-sign-out-alt"></i>
              Đăng xuất
            </button>
          </div>
        </header>
        <div className="dashboard-content">
          <div style={{ backgroundColor: '#fff', borderRadius: '16px', padding: '32px' }}>
            <section className="registration-form-container">

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
                isViewMode ? (
                  /* ════════════ VIEW RECORD DETAIL ════════════ */
                  <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1200px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', height: 'fit-content' }}>
                    <div style={{ backgroundColor: '#f3f4f6', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#374151' }}>Chi tiết thông tin đăng ký</h2>
                    </div>

                    <div style={{ padding: '24px' }}>
                      {/* Grid 4 cột hiển thị thông tin chung */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Hình thức đăng ký</label>
                          <input
                            type="text"
                            value={selectedRecord?.registration_type?.label || ''}
                            readOnly
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Ngày đăng ký sử dụng</label>
                          <input
                            type="text"
                            value={selectedRecord?.date_request_display || ''}
                            readOnly
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Tên công ty</label>
                          <input
                            type="text"
                            value={selectedRecord?.company_id?.name || ''}
                            readOnly
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Số hợp đồng</label>
                          <input
                            type="text"
                            value={selectedRecord?.contract_id?.name || ''}
                            readOnly
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#111827', fontSize: '0.875rem' }}
                          />
                        </div>
                      </div>

                      {/* Phần 2 cột: mặt bằng + tài liệu bên trái, định mức bên phải */}
                      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Mặt bằng thuê</label>
                          <input
                            type="text"
                            value={selectedRecord?.house_id?.name || ''}
                            readOnly
                            style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#111827', fontSize: '0.875rem', marginBottom: '16px' }}
                          />

                          {/* Tài liệu đính kèm */}
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <i className="fa-solid fa-paperclip" style={{ color: '#4b5563' }}></i>
                              <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>Tài liệu đính kèm</span>
                            </div>
                            {selectedRecord?.attachment_ids && selectedRecord.attachment_ids.length > 0 ? (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {selectedRecord.attachment_ids.map((att, idx) => (
                                  <div key={att.id || idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <i className="fa-solid fa-file" style={{ color: '#3b82f6' }}></i>
                                    <a href={att.url || '#'} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.875rem', color: '#3b82f6', textDecoration: 'none' }}>
                                      {att.name || `Tài liệu ${idx + 1}`}
                                    </a>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
                                Không có tài liệu đính kèm.
                              </p>
                            )}
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: '#111827' }}>
                            <thead>
                              <tr style={{ background: '#e5e7eb' }}>
                                <th style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}></th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Hợp đồng</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Thực tế</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Chờ xử lý</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Vượt định mức</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}>Ô tô</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_quota ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_actual ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_pending ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db', color: (allocationLoading ? false : (allocationInfo?.allocation_car_exceeded ?? 0) > 0) ? '#dc2626' : '#111827' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_exceeded ?? 0)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}>Xe máy</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_quota ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_actual ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_pending ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db', color: (allocationLoading ? false : (allocationInfo?.allocation_motorbike_exceeded ?? 0) > 0) ? '#dc2626' : '#111827' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_exceeded ?? 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Bảng danh sách trực tiếp */}
                      <div style={{ marginTop: '32px' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '16px', color: '#374151' }}>Danh sách đăng ký</h3>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'separate', fontSize: '0.875rem', color: '#111827', border: 'none' }}>
                            <thead>
                              <tr style={{ background: '#e5e7eb' }}>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'center', color: '#374151', fontWeight: 600 }}>STT</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Tên nhân viên</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Số điện thoại</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Biển kiểm soát</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Loại xe</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Hãng xe</th>
                                <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151', fontWeight: 600 }}>Xe gửi 30 phút</th>
                              </tr>
                            </thead>
                            <tbody>
                              {parsedData.length > 0 ? (
                                parsedData.map((row, idx) => (
                                  <tr key={row.id} style={{ background: idx % 2 === 0 ? 'transparent' : '#f9fafb' }}>
                                    <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center' }}>{row.stt}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.name}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.phone}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.licensePlate}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.vehicleType}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.brand}</td>
                                    <td style={{ padding: '12px 8px', border: 'none' }}>{row.parkingThirtyMin || '-'}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#6b7280', border: 'none' }}>
                                    Không có dữ liệu
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Actions footer */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #d1d5db' }}>
                        <button onClick={() => navigate('/my/menu')} style={{ padding: '8px 24px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <i className="fa-solid fa-xmark"></i> Đóng
                        </button>
                      </div>
                    </div>
                  </div>
                ) : mode === 'excel' ? (
                  /* ════════════ VIEW EXCEL IMPORT ════════════ */
                  <div style={{ backgroundColor: '#fff', borderRadius: '8px', width: '100%', maxWidth: '1200px', margin: '0 auto', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', overflow: 'hidden', height: 'fit-content' }}>
                    <div style={{ backgroundColor: '#f3f4f6', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 'bold', color: '#374151' }}>Nhập từ file Excel</h2>
                    </div>

                    <div style={{ padding: '24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Hình thức đăng ký <span style={{ color: 'red' }}>(*)</span></label>
                          <select name="registrationType" value={formData.registrationType} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }}>
                            <option value="">-- Chọn hình thức đăng ký --</option>
                            {registrationTypeOptions.map(opt => {
                              const val = opt.value || opt[0];
                              const lbl = opt.label || opt[1];
                              return <option key={val} value={val}>{lbl}</option>;
                            })}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Ngày đăng ký sử dụng <span style={{ color: 'red' }}>(*)</span></label>
                          <input type="date" name="effectiveDate" value={formData.effectiveDate} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }} />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Tên công ty <span style={{ color: 'red' }}>(*)</span></label>
                          <select name="company" value={formData.company} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }}>
                            <option value="">-- Chọn công ty --</option>
                            {landlords.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Số hợp đồng <span style={{ color: 'red' }}>(*)</span></label>
                          <select name="contract" value={formData.contract} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }}>
                            <option value="">-- Chọn số hợp đồng --</option>
                            {contractApartments.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
                        <div style={{ flex: 1 }}>
                          <label style={{ display: 'block', fontSize: '0.875rem', marginBottom: '4px', color: '#4b5563' }}>Mặt bằng thuê <span style={{ color: 'red' }}>(*)</span></label>
                          <select name="buidingHouse" value={formData.buidingHouse} onChange={handleChange} style={{ width: '100%', padding: '8px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb' }}>
                            <option value="">{masterLoading ? 'Đang tải...' : '-- Chọn mặt bằng --'}</option>
                            {buidingHouse.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>

                          <div style={{ marginTop: '16px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                              <i className="fa-solid fa-paperclip" style={{ color: '#4b5563' }}></i>
                              <span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#374151' }}>Tài liệu đính kèm</span>
                            </div>

                            {docsLoading ? (
                              <p style={{ color: '#3b82f6', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
                                ⏳ Đang tải danh sách tài liệu...
                              </p>
                            ) : requiredDocs.length === 0 ? (
                              <p style={{ color: '#6b7280', fontSize: '0.875rem', fontStyle: 'italic', margin: 0 }}>
                                {formData.registrationType
                                  ? 'Không có tài liệu yêu cầu cho hình thức này.'
                                  : 'Vui lòng chọn Hình thức đăng ký để xem danh sách tài liệu.'}
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {requiredDocs.map((doc, index) => {
                                  // ưu tiên document_parking_card_id (field thực tế API trả về)
                                  const docId = String(doc.document_parking_card_id ?? doc.id ?? doc.code ?? index)
                                  return (
                                    <div key={docId} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                      <span style={{ fontSize: '0.875rem', color: '#4b5563', flex: 1 }}>{doc.name || doc.display_name || doc.code}</span>
                                      {!docFileNames[docId] ? (
                                        <label style={{ padding: '6px 12px', border: '1px dashed #3b82f6', borderRadius: '4px', color: '#3b82f6', cursor: 'pointer', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <i className="fa-solid fa-upload"></i> Tải lên
                                          <input type="file" onChange={(e) => handleRequiredDocFileChange(e, docId)} style={{ display: 'none' }} />
                                        </label>
                                      ) : (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                          <span style={{ fontSize: '0.875rem', color: '#10b981', maxWidth: '150px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            <i className="fa-solid fa-check"></i> {docFileNames[docId]}
                                          </span>
                                          <button type="button" onClick={() => {
                                            setDocFileNames(prev => ({ ...prev, [docId]: '' }))
                                            setDocFiles(prev => ({ ...prev, [docId]: null }))
                                          }} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>
                                            <i className="fa-solid fa-trash"></i>
                                          </button>
                                        </div>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ flex: 1 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem', color: '#111827' }}>
                            <thead>
                              <tr style={{ background: '#e5e7eb' }}>
                                <th style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}></th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Hợp đồng</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Thực tế</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Chờ xử lý</th>
                                <th style={{ padding: '12px 8px', textAlign: 'center', border: '1px solid #d1d5db' }}>Vượt định mức</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}>Ô tô</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_quota ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_actual ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_pending ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db', color: (allocationLoading ? false : (allocationInfo?.allocation_car_exceeded ?? 0) > 0) ? '#dc2626' : '#111827' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_car_exceeded ?? 0)}
                                </td>
                              </tr>
                              <tr>
                                <td style={{ padding: '12px 8px', border: '1px solid #d1d5db' }}>Xe máy</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_quota ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_actual ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_pending ?? 0)}
                                </td>
                                <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', border: '1px solid #d1d5db', color: (allocationLoading ? false : (allocationInfo?.allocation_motorbike_exceeded ?? 0) > 0) ? '#dc2626' : '#111827' }}>
                                  {allocationLoading ? '...' : (allocationInfo?.allocation_motorbike_exceeded ?? 0)}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div style={{ borderBottom: '1px solid #d1d5db', display: 'flex', gap: '8px', marginBottom: '24px' }}>
                        <button
                          onClick={() => setActiveTab('upload')}
                          style={{
                            padding: '12px 24px',
                            border: '1px solid #d1d5db',
                            borderBottom: activeTab === 'upload' ? 'none' : '1px solid #d1d5db',
                            background: activeTab === 'upload' ? '#fff' : '#f9fafb',
                            color: activeTab === 'upload' ? '#10b981' : '#4b5563',
                            marginBottom: '-1px',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: activeTab === 'upload' ? 'bold' : 'normal'
                          }}
                        >
                          <i className="fa-solid fa-file-import"></i> Chọn tệp nguồn
                        </button>
                        <button
                          onClick={() => setActiveTab('check')}
                          style={{
                            padding: '12px 24px',
                            border: '1px solid #d1d5db',
                            borderBottom: activeTab === 'check' ? 'none' : '1px solid #d1d5db',
                            background: activeTab === 'check' ? '#fff' : '#f9fafb',
                            color: activeTab === 'check' ? '#10b981' : '#4b5563',
                            marginBottom: '-1px',
                            borderRadius: '4px 4px 0 0',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontWeight: activeTab === 'check' ? 'bold' : 'normal'
                          }}
                        >
                          <i className="fa-solid fa-check"></i> Kiểm tra dữ liệu
                        </button>
                      </div>

                      <div style={{ minHeight: '300px' }}>
                        {activeTab === 'upload' ? (
                          <div style={{ border: '1px solid #d1d5db', borderRadius: '4px', padding: '24px' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 'bold', marginBottom: '16px', color: '#111827' }}>Nhập danh sách đăng ký cấp mới/chuyển công ty/trả thẻ</h3>
                            <ul style={{ paddingLeft: '20px', marginBottom: '24px', color: '#4b5563', lineHeight: '1.8' }}>
                              <li>Nhập danh sách đăng ký cấp mới/chuyển công ty/trả thẻ vào hệ thống</li>
                              <li style={{ color: '#ef4444' }}>Lưu ý: Vui lòng tải lên file excel nhỏ hơn 50MB</li>
                            </ul>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                              <label style={{
                                background: '#e11d48',
                                color: '#fff',
                                padding: '8px 16px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                fontWeight: '500'
                              }}>
                                <i className="fa-solid fa-file-excel"></i> Chọn file
                                <input type="file" accept=".xlsx, .xls" onChange={handleFileUpload} style={{ display: 'none' }} />
                              </label>
                              <div style={{ flex: 1, padding: '8px 16px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#f9fafb', color: '#9ca3af' }}>
                                {excelFileName || 'Không có file được chọn'}
                              </div>
                            </div>

                            <div>
                              <span style={{ color: '#111827' }}>Tải file Import mẫu <a href="#" onClick={handleDownloadTemplate} style={{ color: '#ef4444', textDecoration: 'none', fontStyle: 'italic' }}>tại đây</a></span>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <h3 style={{ textAlign: 'center', color: '#10b981', margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: 'bold' }}>Kiểm tra dữ liệu nhập</h3>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                              <div style={{ display: 'flex', gap: '32px' }}>
                                <span style={{ color: '#10b981', fontWeight: '500' }}>Dữ liệu hợp lệ: {validCount}</span>
                                <span style={{ color: '#ef4444', fontWeight: '500' }}>Dữ liệu không hợp lệ: {invalidCount}</span>
                              </div>
                              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                <button style={{
                                  background: '#3b82f6',
                                  color: '#fff',
                                  border: 'none',
                                  padding: '8px 16px',
                                  borderRadius: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  cursor: 'pointer'
                                }}>
                                  <i className="fa-solid fa-file-export"></i> Xuất dữ liệu lỗi
                                </button>
                                <select
                                  value={filterType}
                                  onChange={(e) => {
                                    const value = e.target.value
                                    setFilterType(value)
                                    if (value === 'invalid') {
                                      setShowManualRow(false)
                                    }
                                  }}
                                  style={{
                                    padding: '8px',
                                    border: '1px solid #ef4444',
                                    borderRadius: '4px',
                                    color: '#ef4444',
                                    background: '#fff',
                                    minWidth: '200px',
                                    outline: 'none'
                                  }}
                                >
                                  <option value="valid">Dữ liệu hợp lệ</option>
                                  <option value="invalid">Dữ liệu không hợp lệ</option>
                                  <option value="all">Tất cả</option>
                                </select>
                              </div>
                            </div>

                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'separate', fontSize: '0.875rem', color: '#111827', border: 'none' }}>
                                <thead>
                                  <tr style={{ background: '#e5e7eb' }}>
                                    <th style={{ padding: '12px 8px', border: 'none' }}>STT</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Tên nhân viên</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Số điện thoại</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Biển kiểm soát</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Loại xe</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Hãng xe</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Xe gửi 30 phút</th>
                                    <th style={{ padding: '12px 8px', border: 'none', textAlign: 'left', color: '#374151' }}>Hình thức thanh toán</th>
                                    {showErrorColumn && (
                                      <th style={{ padding: '12px 8px', border: 'none', textAlign: 'center', color: '#374151' }}>Mô tả lỗi</th>
                                    )}
                                  </tr>
                                </thead>
                                <tbody>
                                  {displayedData.length === 0 && !showManualRow ? (
                                    <tr>
                                      <td colSpan={showErrorColumn ? 10 : 9} style={{ padding: '24px', textAlign: 'center', color: '#6b7280', border: 'none' }}>Không có dữ liệu</td>
                                    </tr>
                                  ) : (
                                    displayedData.map((row, idx) => {
                                      const isEditing = editingRowId === row.id
                                      const currentData = isEditing ? tempRowData : row
                                      return (
                                        <tr
                                          key={row.id}
                                          ref={isEditing ? editingRowRef : null}
                                          style={{
                                            background: idx % 2 === 0 ? 'transparent' : '#f9fafb'
                                          }}>
                                          <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center' }}>{row.stt}</td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.name}
                                                onChange={(e) => handleTempRowChange('name', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.name}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.phone}
                                                onChange={(e) => handleTempRowChange('phone', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.phone}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.licensePlate}
                                                onChange={(e) => handleTempRowChange('licensePlate', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.licensePlate}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.vehicleType}
                                                onChange={(e) => handleTempRowChange('vehicleType', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.vehicleType}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.brand}
                                                onChange={(e) => handleTempRowChange('brand', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.brand}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <select
                                                value={currentData.parkingThirtyMin}
                                                onChange={(e) => handleTempRowChange('parkingThirtyMin', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none', background: '#fff' }}
                                              >
                                                <option value="">Chọn...</option>
                                                <option value="Có">Có</option>
                                                <option value="Không">Không</option>
                                              </select>
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.parkingThirtyMin || '-'}</span>
                                            )}
                                          </td>
                                          <td style={{ padding: '12px 8px', border: 'none' }}>
                                            {isEditing ? (
                                              <input
                                                type="text"
                                                value={currentData.paymentMethod}
                                                onChange={(e) => handleTempRowChange('paymentMethod', e.target.value)}
                                                style={{ width: '100%', padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: '4px', outline: 'none' }}
                                              />
                                            ) : (
                                              <span style={{ display: 'block', width: '100%' }}>{row.paymentMethod}</span>
                                            )}
                                          </td>
                                          {showErrorColumn && (
                                            <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center', color: currentData.isValid ? '#10b981' : '#ef4444', fontWeight: '500' }}>
                                              {currentData.isValid ? '' : (currentData.errors || []).join(', ')}
                                            </td>
                                          )}
                                          <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center' }}>
                                            {isEditing ? (
                                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                  type="button"
                                                  onClick={saveEditRow}
                                                  style={{ background: '#10b981', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                                  title="Lưu"
                                                >
                                                  <i className="fa-solid fa-check"></i>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={cancelEditRow}
                                                  style={{ background: '#6b7280', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
                                                  title="Hủy"
                                                >
                                                  <i className="fa-solid fa-xmark"></i>
                                                </button>
                                              </div>
                                            ) : (
                                              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button
                                                  type="button"
                                                  onClick={() => startEditRow(row)}
                                                  style={{ background: 'transparent', border: 'none', color: '#3b82f6', cursor: 'pointer', fontSize: '1rem' }}
                                                  title="Sửa"
                                                >
                                                  <i className="fa-solid fa-pen-to-square"></i>
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() => removeRow(row.id)}
                                                  style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '1rem' }}
                                                  title="Xóa dòng"
                                                >
                                                  <i className="fa-solid fa-trash"></i>
                                                </button>
                                              </div>
                                            )}
                                          </td>
                                        </tr>
                                      )
                                    })
                                  )}
                                  {showManualRow && (
                                    <tr style={{ background: '#f9fafb' }}>
                                      <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center' }}>+</td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <input
                                          type="text"
                                          name="name"
                                          value={manualRow.name}
                                          onChange={handleManualRowChange}
                                          placeholder="Nhập tên..."
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        />
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <input
                                          type="text"
                                          name="phone"
                                          value={manualRow.phone}
                                          onChange={handleManualRowChange}
                                          placeholder="Nhập SĐT..."
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        />
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <input
                                          type="text"
                                          name="licensePlate"
                                          value={manualRow.licensePlate}
                                          onChange={handleManualRowChange}
                                          placeholder="Nhập biển..."
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        />
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <select
                                          name="vehicleType"
                                          value={manualRow.vehicleType}
                                          onChange={handleManualRowChange}
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        >
                                          <option value="">Chọn loại xe...</option>
                                          {vehicleTypeOptions.map(option => (
                                            <option key={option.id} value={option.name}>{option.name}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <select
                                          name="brand"
                                          value={manualRow.brand}
                                          onChange={handleManualRowChange}
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        >
                                          <option value="">Chọn hãng xe...</option>
                                          {fleetVehicleModelBrand.map(option => (
                                            <option key={option.id} value={option.name}>{option.name}</option>
                                          ))}
                                        </select>
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <select
                                          name="parkingThirtyMin"
                                          value={manualRow.parkingThirtyMin}
                                          onChange={handleManualRowChange}
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        >
                                          <option value="">Chọn...</option>
                                          <option value="Có">Có</option>
                                          <option value="Không">Không</option>
                                        </select>
                                      </td>
                                      <td style={{ padding: '12px 8px', border: 'none' }}>
                                        <select
                                          name="paymentMethod"
                                          value={manualRow.paymentMethod}
                                          onChange={handleManualRowChange}
                                          style={{ width: '100%', border: 'none', outline: 'none', minHeight: '38px', background: 'transparent' }}
                                        >
                                          <option value="">Chọn thanh toán...</option>
                                          {paymentTypeOptions.map(option => (
                                            <option key={option.value} value={option.label}>{option.label}</option>
                                          ))}
                                        </select>
                                      </td>
                                      {showErrorColumn && <td style={{ padding: '12px 8px', border: 'none' }}></td>}
                                      <td style={{ padding: '12px 8px', border: 'none', textAlign: 'center' }}>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            addManualRow()
                                            setShowManualRow(false)
                                          }}
                                          style={{ padding: '8px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                                        >
                                          Lưu
                                        </button>
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              {filterType !== 'invalid' && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (showManualRow) {
                                      addManualRow();
                                    } else {
                                      setShowManualRow(true);
                                    }
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#2563eb',
                                    fontWeight: '600',
                                    cursor: 'pointer',
                                    padding: '0',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Thêm một dòng
                                </button>
                              )}
                              {showManualRow && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowManualRow(false)
                                    setManualRow({
                                      name: '',
                                      phone: '',
                                      licensePlate: '',
                                      vehicleType: '',
                                      brand: '',
                                      parkingThirtyMin: '',
                                      paymentMethod: '',
                                    })
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#6b7280',
                                    cursor: 'pointer',
                                    padding: '0',
                                    textDecoration: 'underline',
                                  }}
                                >
                                  Hủy
                                </button>
                              )}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <button
                                  onClick={handlePrevPage}
                                  disabled={currentPage === 1}
                                  style={{
                                    padding: '4px 12px',
                                    border: '1px solid #d1d5db',
                                    background: currentPage === 1 ? '#f3f4f6' : '#fff',
                                    borderRadius: '4px',
                                    cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                                    color: currentPage === 1 ? '#9ca3af' : '#374151'
                                  }}
                                >
                                  &lt;
                                </button>
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                  <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    style={{
                                      padding: '4px 12px',
                                      border: '1px solid #d1d5db',
                                      background: currentPage === page ? '#e5e7eb' : '#fff',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      color: currentPage === page ? '#111827' : '#374151'
                                    }}
                                  >
                                    {page}
                                  </button>
                                ))}
                                <button
                                  onClick={handleNextPage}
                                  disabled={currentPage === totalPages || totalPages === 0}
                                  style={{
                                    padding: '4px 12px',
                                    border: '1px solid #d1d5db',
                                    background: currentPage === totalPages || totalPages === 0 ? '#f3f4f6' : '#fff',
                                    borderRadius: '4px',
                                    cursor: currentPage === totalPages || totalPages === 0 ? 'not-allowed' : 'pointer',
                                    color: currentPage === totalPages || totalPages === 0 ? '#9ca3af' : '#374151'
                                  }}
                                >
                                  &gt;
                                </button>
                                <select
                                  value={itemsPerPage}
                                  onChange={handleItemsPerPageChange}
                                  style={{ padding: '4px 8px', border: '1px solid #d1d5db', background: '#fff', borderRadius: '4px', marginLeft: '8px' }}
                                >
                                  <option value={5}>5/trang</option>
                                  <option value={10}>10/trang</option>
                                  <option value={20}>20/trang</option>
                                  <option value={50}>50/trang</option>
                                </select>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '16px', marginTop: '32px', paddingTop: '16px', borderTop: '1px solid #d1d5db' }}>
                        {activeTab === 'upload' ? (
                          <>
                            <button onClick={() => navigate('/my/menu')} style={{ padding: '8px 24px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <i className="fa-solid fa-xmark"></i> Đóng
                            </button>
                            <button onClick={() => setActiveTab('check')} style={{ padding: '8px 24px', border: 'none', borderRadius: '4px', background: '#e11d48', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              Tiếp <i className="fa-solid fa-chevron-right"></i>
                            </button>
                          </>
                        ) : (
                          <button onClick={handleSubmitExcel} style={{ padding: '8px 24px', border: 'none', borderRadius: '4px', background: '#e11d48', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-save"></i> Lưu dữ liệu hợp lệ
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null
              )}

            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
