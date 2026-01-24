// Force dynamic rendering to prevent build-time errors
export const dynamic = 'force-dynamic'

export default function TestEnvPage() {
  const envVars = {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'NOT SET',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
      ? `${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 20)}...` 
      : 'NOT SET',
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY
      ? `${process.env.SUPABASE_SERVICE_ROLE_KEY.substring(0, 20)}...`
      : 'NOT SET',
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Environment Variables Test</h1>
      <div className="space-y-2">
        <div>
          <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>{' '}
          <code className="bg-gray-100 px-2 py-1 rounded">
            {envVars.NEXT_PUBLIC_SUPABASE_URL}
          </code>
        </div>
        <div>
          <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>{' '}
          <code className="bg-gray-100 px-2 py-1 rounded">
            {envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY}
          </code>
        </div>
        <div>
          <strong>SUPABASE_SERVICE_ROLE_KEY:</strong>{' '}
          <code className="bg-gray-100 px-2 py-1 rounded">
            {envVars.SUPABASE_SERVICE_ROLE_KEY}
          </code>
        </div>
      </div>
      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h2 className="font-bold mb-2">Instructions:</h2>
        <ol className="list-decimal list-inside space-y-1">
          <li>Make sure your <code>.env.local</code> file is in the project root</li>
          <li>Ensure variables start with <code>NEXT_PUBLIC_</code> for client-side access</li>
          <li>No quotes around values (e.g., <code>KEY=value</code> not <code>KEY="value"</code>)</li>
          <li>No spaces around the <code>=</code> sign</li>
          <li>Restart the dev server after changing .env.local</li>
        </ol>
      </div>
    </div>
  )
}
