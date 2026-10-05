import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LanguageProvider } from '../i18n'
import Overview from './Overview'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
afterEach(() => { cleanup(); request.mockReset(); vi.useRealTimers() })
it('day/month chart uses report API and received-payment card links to the corresponding order filter', async () => {
  localStorage.setItem('lang', 'en')
  request.mockImplementation(async path => path === '/admin/overview' ? { received: 100, revenue: 200, orders: 1, pending: 1, delivered: 0, low_stock: 2 } : { series: [{ date: '2026-10-05', orders: 1, order_value: 200, received: 100 }], order_value: 200, received: 100 })
  render(<MemoryRouter><LanguageProvider><Overview /></LanguageProvider></MemoryRouter>)
  await screen.findByRole('img', { name: /Order value and received payment chart/ })
  expect(screen.getByRole('link', { name: /Total payment received/ }).getAttribute('href')).toBe('/admin/orders?paid=received&scope=real')
  expect(screen.getByRole('link', { name: /Products with stock/ }).getAttribute('href')).toBe('/admin/inventory/products?stock=low_or_out')
  expect(document.querySelectorAll('polyline')).toHaveLength(2)
  expect(document.querySelectorAll('rect')).toHaveLength(0)
  const first = request.mock.calls.find(([path]) => path.startsWith('/admin/report'))[0]
  const initial = new URLSearchParams(first.split('?')[1])
  expect(initial.get('start')).toMatch(/-01$/)
  fireEvent.click(screen.getByRole('button', { name: 'By month' }))
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('period=month'))).toBe(true))
})

it('hides the previous chart while a new period is loading and filters card links consistently', async () => {
  localStorage.setItem('lang', 'en')
  let finish
  request.mockImplementation(path => {
    if (path.startsWith('/admin/overview')) return Promise.resolve({})
    if (path.includes('period=month')) return new Promise(resolve => { finish = resolve })
    return Promise.resolve({ series: [{ date: '2026-10-05', orders: 1, order_value: 10, received: 0 }], order_value: 10, received: 0 })
  })
  render(<MemoryRouter><LanguageProvider><Overview /></LanguageProvider></MemoryRouter>)
  await screen.findByRole('img')
  fireEvent.click(screen.getByRole('button', { name: 'By month' }))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(screen.queryByRole('img')).toBe(null)
  expect(screen.getByRole('link', { name: /Total payment received/ }).getAttribute('aria-disabled')).toBe('true')
  finish({ series: [{ date: '2026-10', orders: 1, order_value: 20, received: 0 }], order_value: 20, received: 0 })
  await screen.findByRole('img')
  fireEvent.click(screen.getByLabelText('Include test orders in statistics'))
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('include_test=true'))).toBe(true))
  expect(screen.getByRole('link', { name: /Total payment received/ }).getAttribute('href')).toBe('/admin/orders?paid=received')
})

it('switches to the new Vietnam calendar month when returning to the page', async () => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-31T16:59:00Z'))
  localStorage.setItem('lang', 'en')
  request.mockImplementation(async path => path === '/admin/overview' ? {} : { series: [], order_value: 0, received: 0 })
  render(<MemoryRouter><LanguageProvider><Overview /></LanguageProvider></MemoryRouter>)
  await screen.findByRole('img')
  expect(screen.getByLabelText('Month').value).toBe('2026-10')
  vi.setSystemTime(new Date('2026-10-31T17:01:00Z'))
  fireEvent(window, new Event('focus'))
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('start=2026-11-01') && path.includes('end=2026-11-30'))).toBe(true))
  expect(screen.getByLabelText('Month').value).toBe('2026-11')
})

it('selecting a month requests every calendar day without carrying over previous-month totals', async () => {
  localStorage.setItem('lang', 'en')
  request.mockImplementation(async path => path === '/admin/overview' ? {} : { series: [], order_value: 0, received: 0 })
  render(<MemoryRouter><LanguageProvider><Overview /></LanguageProvider></MemoryRouter>)
  await screen.findByRole('img')
  fireEvent.change(screen.getByLabelText('Month'), { target: { value: '2028-02' } })
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('start=2028-02-01') && path.includes('end=2028-02-29'))).toBe(true))
  fireEvent.click(screen.getByRole('button', { name: 'By month' }))
  await waitFor(() => expect(request.mock.calls.some(([path]) => path.includes('start=2028-01-01') && path.includes('end=2028-12-31'))).toBe(true))
})
