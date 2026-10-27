import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Orders from './Orders'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'cust-1' } }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  request.mockReset()
})

const orderWithShipping = {
  id: 'order-ship-1',
  created_at: '2026-10-27T08:00:00Z',
  status: 'shipped',
  payment: 'cod',
  total: 590000,
  subtotal: 590000,
  discount: 0,
  promotion_code: '',
  delivery: {
    name: 'Nguyễn Văn A',
    phone: '0912345678',
    address: '123 Đường Lê Lợi, Phường Bến Nghé',
    city: 'Hồ Chí Minh',
    carrier: 'Giao Hàng Nhanh (GHN)',
    tracking_code: 'GHN88899911',
  },
  items: [
    {
      product_id: 1,
      name: 'Áo sơ mi lụa',
      name_en: 'Silk shirt',
      color: 'black',
      color_en: 'Black',
      size: 'L',
      quantity: 1,
      price: 590000,
    },
  ],
}

it('displays carrier and tracking code with direct tracking link for customers', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockResolvedValue({ orders: [orderWithShipping], total: 1, pages: 1, page: 1 })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Orders />
      </LanguageProvider>
    </MemoryRouter>
  )

  await screen.findByText(/Giao Hàng Nhanh \(GHN\)/)
  expect(screen.getByText('GHN88899911')).toBeTruthy()

  const trackLink = screen.getByRole('link', { name: /Tra cứu hành trình/i })
  expect(trackLink.getAttribute('href')).toContain('tracking.ghn.vn/?order_code=GHN88899911')
})

it('opens invoice modal when clicking view invoice button and can close it', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockResolvedValue({ orders: [orderWithShipping], total: 1, pages: 1, page: 1 })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Orders />
      </LanguageProvider>
    </MemoryRouter>
  )

  const invoiceBtn = await screen.findByRole('button', { name: /Hóa đơn điện tử/i })
  fireEvent.click(invoiceBtn)

  // Modal appears
  await screen.findByText(/PHIẾU GIAO HÀNG & HÓA ĐƠN/i)
  expect(screen.getByText(/GỬI TỪ \(SENDER\):/i)).toBeTruthy()
  expect(screen.getByText(/TIỀN THU NGƯỜI NHẬN \(COD\):/i)).toBeTruthy()

  // Close modal
  const closeBtn = screen.getByRole('button', { name: /Đóng/i })
  fireEvent.click(closeBtn)

  await waitFor(() => {
    expect(screen.queryByText(/PHIẾU GIAO HÀNG & HÓA ĐƠN/i)).toBeNull()
  })
})

it('admin can open shipping modal, choose carrier and update tracking code', async () => {
  localStorage.setItem('lang', 'vi')
  let currentOrder = { ...orderWithShipping, delivery: { ...orderWithShipping.delivery, carrier: '', tracking_code: '' } }

  request.mockImplementation(async (path, options) => {
    if (path.includes('/shipping') && options?.method === 'PATCH') {
      const body = options.body
      currentOrder = {
        ...currentOrder,
        delivery: { ...currentOrder.delivery, carrier: body.carrier, tracking_code: body.tracking_code },
      }
      return currentOrder
    }
    return { orders: [currentOrder], total: 1, pages: 1, page: 1 }
  })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Orders admin />
      </LanguageProvider>
    </MemoryRouter>
  )

  const trackingBtn = await screen.findByRole('button', { name: /Gán mã vận đơn|Sửa mã vận đơn/i })
  fireEvent.click(trackingBtn)

  // Shipping modal opened
  await screen.findByText(/Giao hàng & Mã vận đơn/i)

  // Change tracking code
  const trackingInput = screen.getByPlaceholderText(/GHN12345678/i)
  fireEvent.change(trackingInput, { target: { value: 'VTP123456789' } })

  // Submit modal
  fireEvent.click(screen.getByRole('button', { name: /Xác nhận gửi hàng/i }))

  await waitFor(() => {
    expect(currentOrder.delivery.tracking_code).toBe('VTP123456789')
  })
})

it('admin can push order to GHN Sandbox with one click', async () => {
  localStorage.setItem('lang', 'vi')
  vi.stubGlobal('confirm', vi.fn(() => true))
  let currentOrder = { ...orderWithShipping, status: 'confirmed', delivery: { ...orderWithShipping.delivery, carrier: '', tracking_code: '' } }

  request.mockImplementation(async (path, options) => {
    if (path.includes('/push-ghn') && options?.method === 'POST') {
      currentOrder = {
        ...currentOrder,
        status: 'shipped',
        delivery: { ...currentOrder.delivery, carrier: 'Giao Hàng Nhanh (GHN)', tracking_code: 'LYQGKD' },
      }
      return currentOrder
    }
    return { orders: [currentOrder], total: 1, pages: 1, page: 1 }
  })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Orders admin />
      </LanguageProvider>
    </MemoryRouter>
  )

  const pushBtn = await screen.findByRole('button', { name: /Đẩy sang GHN/i })
  fireEvent.click(pushBtn)

  await waitFor(() => {
    expect(currentOrder.delivery.tracking_code).toBe('LYQGKD')
  })
})
