import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Measurements from './Measurements'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'cust-123' } }) }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  request.mockReset()
})

it('loads existing measurements and allows editing and saving', async () => {
  localStorage.setItem('lang', 'vi')
  let savedData = {
    height: 175,
    weight: 68,
    chest: 96,
    waist: 78,
    hips: 94,
    shoulder: 44,
    fit_preference: 'regular',
  }

  request.mockImplementation(async (path, options) => {
    if (path === '/account/measurements' && options?.method === 'PUT') {
      savedData = JSON.parse(options.body)
      return { measurements: savedData }
    }
    return { measurements: savedData }
  })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Measurements />
      </LanguageProvider>
    </MemoryRouter>
  )

  // Verify inputs loaded
  await waitFor(() => {
    expect(screen.getByLabelText(/Chiều cao/i).value).toBe('175')
  })
  expect(screen.getByLabelText(/Cân nặng/i).value).toBe('68')
  expect(screen.getByLabelText(/Vòng ngực/i).value).toBe('96')

  // Edit chest
  fireEvent.change(screen.getByLabelText(/Vòng ngực/i), { target: { value: '98' } })

  // Save
  fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ số đo/i }))

  await screen.findByText(/Đã lưu số đo thành công/i)
  expect(savedData.chest).toBe(98)
})

it('estimates circumferences from height and weight', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockResolvedValue({ measurements: null })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Measurements />
      </LanguageProvider>
    </MemoryRouter>
  )

  await waitFor(() => {
    expect(screen.getByLabelText(/Chiều cao/i)).toBeTruthy()
  })

  // Enter height and weight
  fireEvent.change(screen.getByLabelText(/Chiều cao/i), { target: { value: '170' } })
  fireEvent.change(screen.getByLabelText(/Cân nặng/i), { target: { value: '60' } })

  // Click estimate
  fireEvent.click(screen.getByRole('button', { name: /Ước tính các vòng/i }))

  // Verify chest is estimated
  await waitFor(() => {
    expect(Number(screen.getByLabelText(/Vòng ngực/i).value)).toBeGreaterThan(80)
  })
})

it('accepts and normalizes comma-decimal inputs like 80,2 and saves successfully', async () => {
  localStorage.setItem('lang', 'vi')
  let savedData = null

  request.mockImplementation(async (path, options) => {
    if (path === '/account/measurements' && options?.method === 'PUT') {
      savedData = typeof options.body === 'string' ? JSON.parse(options.body) : options.body
      return { measurements: savedData }
    }
    return { measurements: null }
  })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Measurements />
      </LanguageProvider>
    </MemoryRouter>
  )

  await waitFor(() => {
    expect(screen.getByLabelText(/Chiều cao/i)).toBeTruthy()
  })

  // User input from screenshot: height 172, weight 55, chest 80.2, waist 62, hips 78, shoulder 43
  fireEvent.change(screen.getByLabelText(/Chiều cao/i), { target: { value: '172' } })
  fireEvent.change(screen.getByLabelText(/Cân nặng/i), { target: { value: '55' } })
  fireEvent.change(screen.getByLabelText(/Vòng ngực/i), { target: { value: '80.2' } })
  fireEvent.change(screen.getByLabelText(/Vòng eo/i), { target: { value: '62' } })
  fireEvent.change(screen.getByLabelText(/Vòng hông/i), { target: { value: '78' } })
  fireEvent.change(screen.getByLabelText(/Rộng vai/i), { target: { value: '43' } })

  // Click Save
  fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ số đo/i }))

  await screen.findByText(/Đã lưu số đo thành công/i)
  expect(savedData).toBeTruthy()
  expect(savedData.height).toBe(172)
  expect(savedData.weight).toBe(55)
  expect(savedData.chest).toBe(80.2)
  expect(savedData.waist).toBe(62)
  expect(savedData.hips).toBe(78)
  expect(savedData.shoulder).toBe(43)
})

it('validates out-of-range inputs before sending payload', async () => {
  localStorage.setItem('lang', 'vi')
  request.mockResolvedValue({ measurements: null })

  render(
    <MemoryRouter>
      <LanguageProvider>
        <Measurements />
      </LanguageProvider>
    </MemoryRouter>
  )

  await waitFor(() => {
    expect(screen.getByLabelText(/Chiều cao/i)).toBeTruthy()
  })

  // Invalid height
  fireEvent.change(screen.getByLabelText(/Chiều cao/i), { target: { value: '30' } })
  fireEvent.click(screen.getByRole('button', { name: /Lưu hồ sơ số đo/i }))

  await screen.findByText(/Chiều cao phải từ 50 đến 250 cm/i)
})
