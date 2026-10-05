import { useSearchParams } from 'react-router-dom'
import ProductList from './ProductList'

export default function Search() {
  const [params] = useSearchParams()
  const query = (params.get('q') || '').trim().slice(0, 120)
  return <ProductList searchQuery={query} />
}
