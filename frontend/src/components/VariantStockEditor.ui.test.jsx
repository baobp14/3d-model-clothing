import { afterEach, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useState } from 'react'
import { LanguageProvider } from '../i18n'
import VariantStockEditor from './VariantStockEditor'

const { request } = vi.hoisted(() => ({ request: vi.fn() }))
vi.mock('../lib/api', () => ({ shopApi: { request } }))
afterEach(() => { cleanup(); request.mockReset() })
it('initial setup requires explicit allocation equal to existing stock and saves its revision', async () => {
  localStorage.setItem('lang', 'en')
  const product = { id: 1, colors: ['black'], sizes: ['M', 'L'], stock: 5, variants: null, stockRevision: null }
  request.mockResolvedValue({ id: 1, name_vi: 'Áo', name_en: 'Shirt', colors: ['black'], sizes: ['M', 'L'], stock: 5, variants: [{ color: 'black', size: 'M', stock: 1 }, { color: 'black', size: 'L', stock: 4 }], stock_revision: 0 })
  function Editor() { const [current, setCurrent] = useState(product); return <VariantStockEditor product={current} onSave={setCurrent} /> }
  render(<MemoryRouter><LanguageProvider><Editor /></LanguageProvider></MemoryRouter>)
  expect(screen.getByRole('button', { name: 'Save variant stock' }).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Stock black M'), { target: { value: '1' } })
  fireEvent.change(screen.getByLabelText('Stock black L'), { target: { value: '4' } })
  fireEvent.change(screen.getByLabelText('Stock allocation/adjustment reason'), { target: { value: 'Physical count' } })
  fireEvent.click(screen.getByRole('button', { name: 'Save variant stock' }))
  await screen.findByText('Variant stock saved.')
  expect(request.mock.calls[0]).toEqual(['/admin/products/1/variants', { method: 'PATCH', auth: true, body: { reason: 'Physical count', expected_revision: null, expected_stock: 5, variants: [{ color: 'black', size: 'M', stock: 1 }, { color: 'black', size: 'L', stock: 4 }] } }])
})
