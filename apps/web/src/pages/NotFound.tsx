import { Link } from 'react-router'
import { Button } from '../components/ui'

export function NotFound() {
  return (
    <div className="py-24 text-center">
      <p className="font-mono text-sm text-faint">404</p>
      <h1 className="mt-2 text-xl font-semibold">Nothing streaming here</h1>
      <Link to="/" className="mt-6 inline-block">
        <Button>Back to overview</Button>
      </Link>
    </div>
  )
}
