import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { authFetch } from '../utils/authApi';
import { getCurrentUserId } from '../utils/tokenManager';
import logoImg from '../assets/images/hapulico-logo.jpg';

export default function Menu() {
  const navigate = useNavigate();
  const [activeNav, setActiveNav] = useState('vehicle');
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter states
  const [filterRegistrationType, setFilterRegistrationType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterHouse, setFilterHouse] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const currentUserId = useMemo(() => getCurrentUserId(), []);

  const handleLogout = () => {
    localStorage.removeItem('loggedIn');
    navigate('/');
  };

  const isCreatedByCurrentUser = (record) => {
    if (!currentUserId) return true;

    const ownerCandidates = [
      record.create_uid,
      record.created_by,
      record.creator,
      record.user_id,
      record.registrant_id,
      record.owner_id,
    ];

    return ownerCandidates.some((field) => {
      if (!field) return false;
      if (typeof field === 'object') {
        return [field.id, field.uid, field.user_id].some(
          (value) => value != null && String(value) === String(currentUserId)
        );
      }
      return String(field) === String(currentUserId);
    });
  };

  const isOnlineRegistration = (record) => {
    if (!record) return false;

    const method = record.registration_method;
    if (!method) return false;

    if (typeof method === 'string') {
      return method.toLowerCase() === 'online';
    }

    if (typeof method === 'object') {
      return [method.key, method.label, method.name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase() === 'online');
    }

    return false;
  };

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');
      try {
        const res = await authFetch('/api/v1/office-parking', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (data.result?.RESULT === 'SUCCESS' || data.result?.STATUS_CODE === '0000') {
          const items = data.result?.DATA?.items || [];
          setRecords(items.filter((item) => isCreatedByCurrentUser(item) && isOnlineRegistration(item)));
        } else {
          throw new Error(data.result?.MESSAGE || 'Failed to fetch data');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [currentUserId]);

  // Get unique registration types, statuses, and houses from records for filter options
  const { registrationTypes, statuses, houses } = useMemo(() => {
    const regTypesSet = new Set();
    const statusesSet = new Set();
    const housesSet = new Set();
    records.forEach(record => {
      if (record.registration_type?.key && record.registration_type?.label) {
        regTypesSet.add(JSON.stringify(record.registration_type));
      }
      if (record.state?.key && record.state?.label) {
        statusesSet.add(JSON.stringify(record.state));
      }
      if (record.house_id?.id && record.house_id?.name) {
        housesSet.add(JSON.stringify(record.house_id));
      }
    });
    return {
      registrationTypes: Array.from(regTypesSet).map(str => JSON.parse(str)),
      statuses: Array.from(statusesSet).map(str => JSON.parse(str)),
      houses: Array.from(housesSet).map(str => JSON.parse(str))
    };
  }, [records]);

  // Apply filters to records
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Filter by registration type
      if (filterRegistrationType) {
        if (record.registration_type?.key !== filterRegistrationType) {
          return false;
        }
      }

      // Filter by status
      if (filterStatus) {
        if (record.state?.key !== filterStatus) {
          return false;
        }
      }

      // Filter by house
      if (filterHouse) {
        if (String(record.house_id?.id) !== filterHouse) {
          return false;
        }
      }

      // Filter by date range
      if (filterDateFrom || filterDateTo) {
        // Parse record date from date_request field (format: "YYYY-MM-DD HH:mm:ss")
        const recordDateStr = record.date_request?.split(' ')[0];
        if (!recordDateStr) return false;
        const recordDate = new Date(recordDateStr);

        if (filterDateFrom) {
          const fromDate = new Date(filterDateFrom);
          if (recordDate < fromDate) return false;
        }
        if (filterDateTo) {
          const toDate = new Date(filterDateTo);
          if (recordDate > toDate) return false;
        }
      }

      return true;
    });
  }, [records, filterRegistrationType, filterStatus, filterHouse, filterDateFrom, filterDateTo]);

  const getStatusColor = (stateKey) => {
    switch (stateKey) {
      case 'draft':
        return 'blue';
      case 'confirmed':
        return 'yellow';
      case 'done':
        return 'green';
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  return (
    <div className="dashboard-shell">
      {/* Left Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="dashboard-logo">
          <img src={logoImg} alt="Hapulico Logo" />
        </div>
        <nav className="dashboard-nav">
          <div
            className={`dashboard-nav-item ${activeNav === 'vehicle' ? 'active' : ''}`}
            onClick={() => setActiveNav('vehicle')}
          >
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

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div className="dashboard-header-left">
            <div>
              <h1 className="dashboard-header-title">Đăng ký thẻ xe</h1>
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
          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginBottom: '20px' }}>
            <button className="btn-secondary" onClick={() => navigate('/my/vehicle-registration', { state: { mode: 'excel' } })}>
              <i className="fa-solid fa-file-excel"></i>
              Thao tác excel
            </button>
            <button className="btn-primary" onClick={() => navigate('/my/vehicle-registration', { state: { mode: 'manual' } })}>
              <i className="fa-solid fa-plus"></i>
              Thêm mới
            </button>
          </div>

          {/* Filters */}
          <div className="dashboard-filters">
            {/* Hình thức đăng ký */}
            <div className="filter-group">
              <label className="filter-label">Hình thức đăng ký</label>
              <select 
                className="filter-select" 
                value={filterRegistrationType}
                onChange={(e) => setFilterRegistrationType(e.target.value)}
              >
                <option value="">-- Chọn --</option>
                {registrationTypes.map(type => (
                  <option key={type.key} value={type.key}>{type.label}</option>
                ))}
              </select>
            </div>

            {/* Trạng thái */}
            <div className="filter-group">
              <label className="filter-label">Trạng thái</label>
              <select 
                className="filter-select" 
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="">-- Chọn --</option>
                {statuses.map(status => (
                  <option key={status.key} value={status.key}>{status.label}</option>
                ))}
              </select>
            </div>

            {/* Mặt bằng */}
            <div className="filter-group">
              <label className="filter-label">Mặt bằng</label>
              <select 
                className="filter-select" 
                value={filterHouse}
                onChange={(e) => setFilterHouse(e.target.value)}
              >
                <option value="">-- Chọn --</option>
                {houses.map(house => (
                  <option key={house.id} value={String(house.id)}>{house.name}</option>
                ))}
              </select>
            </div>

            {/* Ngày đăng ký */}
            <div className="filter-group">
              <label className="filter-label">Ngày đăng ký</label>
              <div className="filter-date-range">
                <input 
                  type="date" 
                  className="filter-date-input" 
                  value={filterDateFrom}
                  onChange={(e) => setFilterDateFrom(e.target.value)}
                />
                <span className="filter-date-separator">→</span>
                <input 
                  type="date" 
                  className="filter-date-input" 
                  value={filterDateTo}
                  onChange={(e) => setFilterDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Reset filter button */}
            <button 
              className="btn-reset"
              onClick={() => {
                setFilterRegistrationType('');
                setFilterStatus('');
                setFilterHouse('');
                setFilterDateFrom('');
                setFilterDateTo('');
              }}
            >
              <i className="fa-solid fa-rotate-right"></i>
              Đặt lại
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="notice" style={{ marginBottom: '20px', color: 'red' }}>
              {error}
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px' }}></i>
              <p style={{ marginTop: '8px' }}>Đang tải dữ liệu...</p>
            </div>
          )}

          {/* Table */}
          {!loading && (
            <div className="dashboard-table-container">
              <table className="dashboard-table">
                <thead>
                  <tr>
                    <th>STT</th>
                    <th>Hình thức đăng ký</th>
                    <th>Ngày đăng ký</th>
                    <th>Số hợp đồng</th>
                    <th>Mặt bằng</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '40px' }}>
                        Không có dữ liệu
                      </td>
                    </tr>
                  ) : (
                    filteredRecords.map((record, index) => (
                      <tr key={record.id}>
                        <td>{index + 1}</td>
                        <td>{record.registration_type?.label || ''}</td>
                        <td>{record.date_request_display || ''}</td>
                        <td>{record.contract_id?.name || ''}</td>
                        <td>{record.house_id?.name || ''}</td>
                        <td>
                          <span style={{
                            padding: '4px 12px',
                            borderRadius: '12px',
                            backgroundColor: getStatusColor(record.state?.key) === 'blue' ? '#e3f2fd' :
                                             getStatusColor(record.state?.key) === 'yellow' ? '#fff3e0' :
                                             getStatusColor(record.state?.key) === 'green' ? '#e8f5e9' :
                                             getStatusColor(record.state?.key) === 'red' ? '#ffebee' : '#f5f5f5',
                            color: getStatusColor(record.state?.key) === 'blue' ? '#1976d2' :
                                   getStatusColor(record.state?.key) === 'yellow' ? '#f57c00' :
                                   getStatusColor(record.state?.key) === 'green' ? '#388e3c' :
                                   getStatusColor(record.state?.key) === 'red' ? '#d32f2f' : '#616161',
                            fontWeight: '500'
                          }}>
                            {record.state?.label || ''}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
