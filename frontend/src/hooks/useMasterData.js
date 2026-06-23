import { useState, useEffect } from 'react'
import { authFetch } from '../utils/authApi'

// Fallback khi API không trả về selections (Odoo selection fields tĩnh)
const FALLBACK_REGISTRATION_TYPE_OPTIONS = [
  { value: 'create', label: 'Cấp mới' },
  { value: 'change_plate', label: 'Đổi biển kiểm soát' },
  { value: 'lock_card', label: 'Khóa thẻ' },
  { value: 'unlock_card', label: 'Mở khóa thẻ' },
  { value: 'return_card', label: 'Trả thẻ' },
  { value: 'damaged_reissue', label: 'Hỏng thẻ cấp lại' },
  { value: 'lost_reissue', label: 'Mất thẻ cấp lại' },
]

const FALLBACK_TYPE_PARTNER_OPTIONS = [
  { value: 'office', label: 'Văn phòng' },
  { value: 'resident', label: 'Cư dân' },
]

/**
 * Shared hook để fetch master data dùng chung giữa các form đăng ký xe.
 * Trả về: partners, typePartnerOptions, registrationTypeOptions, vehicleTypeOptions,
 *          feeConfigOptions, loading, error
 */
export function useMasterData() {
  const [landlords, setLandlords] = useState([])
  const [typePartnerOptions, setTypePartnerOptions] = useState([])
  const [registrationTypeOptions, setRegistrationTypeOptions] = useState([])
  const [vehicleTypeOptions, setVehicleTypeOptions] = useState([])
  const [feeConfigOptions, setFeeConfigOptions] = useState([])
  const [contractApartments, setContractApartments] = useState([])
  const [buidingHouse, setBuildingHouse] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function fetchMasterData() {
      setLoading(true)
      setError('')
      try {
        const res = await authFetch('/api/v1/data/batch', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            queries: [
              {
                key: 'partners',
                model: 'res.partner',
                fields: ['id', 'name'],
                domain: [["is_customer", "=", true]],
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
                  ['state', '=', 'active'],
                  ['type_fee', '=', 'deposit'],
                ],
                limit: 200,
                offset: 0,
                order: 'name asc',
                depth: 0,
              },
              {
                key: 'contract_apartments',
                model: 'contract.appartment',
                fields: ['id', 'name', 'partner_id', 'premises_line_ids'],
                domain: [
                  ['state', '=', 'active'],
                ],
                limit: 200,
                offset: 0,
                order: 'name asc',
                depth: 0,
              },
              {
                key: 'building_houses',
                model: 'building.house',
                fields: ['id', 'name'],
                domain: [
                ],
                limit: 200,
                offset: 0,
                order: 'name asc',
                depth: 0,
              },
            ],
            selections: [
              {
                key: 'type_partner_options',
                model: 'vehicle.card.register',
                field: 'type_partner',
              },
              {
                key: 'registration_type_options',
                model: 'vehicle.card.register',
                field: 'registration_type',
              },
            ],
          }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        console.log('trạng thái call:', data)

        const result = data.result?.DATA || {}

        setLandlords(result.partners ?? [])
        setBuildingHouse(result.building_houses ?? [])
        setContractApartments(result.contract_apartments ?? [])

        // Dùng data từ API, fallback về hardcode nếu rỗng
        const apiTypePartner = result.type_partner_options ?? []
        setTypePartnerOptions(apiTypePartner.length > 0 ? apiTypePartner : FALLBACK_TYPE_PARTNER_OPTIONS)

        const apiRegType = result.registration_type_options ?? []
        setRegistrationTypeOptions(apiRegType.length > 0 ? apiRegType : FALLBACK_REGISTRATION_TYPE_OPTIONS)

        setVehicleTypeOptions(result.vehicle_types ?? [])
        setFeeConfigOptions(result.fee_configs ?? [])
      } catch (err) {
        console.error('Fetch master data error:', err)
        setError('Không thể tải cấu hình dữ liệu')
        // Fallback khi lỗi hoàn toàn
        setRegistrationTypeOptions(FALLBACK_REGISTRATION_TYPE_OPTIONS)
        setTypePartnerOptions(FALLBACK_TYPE_PARTNER_OPTIONS)
      } finally {
        setLoading(false)
      }
    }
    fetchMasterData()
  }, [])

  return {
    landlords,
    typePartnerOptions,
    registrationTypeOptions,
    vehicleTypeOptions,
    feeConfigOptions,
    contractApartments,
    loading,
    error,
    buidingHouse,
  }
}
