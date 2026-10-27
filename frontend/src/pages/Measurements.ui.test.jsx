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
