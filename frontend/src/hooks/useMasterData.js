import { useState, useEffect } from 'react'
import { authFetch } from '../utils/authApi'

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
                  ['state', '=', 'active'],
                  ['type_fee', '=', 'deposit'],
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
        console.log('[useMasterData batch response]', data)

        const result = data.result?.DATA || {}
        setLandlords(result.partners ?? [])
        setTypePartnerOptions(result.type_partner_options ?? [])
        setRegistrationTypeOptions(result.registration_type_options ?? [])
        setVehicleTypeOptions(result.vehicle_types ?? [])
        setFeeConfigOptions(result.fee_configs ?? [])
      } catch (err) {
        console.error('Fetch master data error:', err)
        setError('Không thể tải cấu hình dữ liệu')
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
    loading,
    error,
  }
}
