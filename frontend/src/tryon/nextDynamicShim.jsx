// The 3D try-on code lives in the Next.js app (../src) and loads its canvas with
// next/dynamic. In the Vite shop the same call maps onto React.lazy.
import { lazy, Suspense } from 'react'

export default function dynamic(loader, options = {}) {
  const Lazy = lazy(() => loader().then(mod => ({ default: mod.default ?? mod })))
  const Loading = options.loading
  return function Dynamic(props) {
    return <Suspense fallback={Loading ? <Loading /> : null}><Lazy {...props} /></Suspense>
  }
}
