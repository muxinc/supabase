'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function TestPage() {
  const [status, setStatus] = useState<string>('Testing connection...')
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<any>(null)

  useEffect(() => {
    async function testConnection() {
      try {
        console.log('Testing Supabase connection...')
        console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL)
        
        // Test basic connection
        const { data: testData, error: testError } = await supabase
          .from('workflow_executions')
          .select('count')
          .limit(1)

        if (testError) {
          console.error('Connection error:', testError)
          setError(testError)
          setStatus('Connection failed!')
        } else {
          console.log('Connection successful!', testData)
          setStatus('Connection successful!')
          
          // Try to fetch actual data
          const { data: executions, error: fetchError } = await supabase
            .from('workflow_executions')
            .select('*')
            .limit(5)
            
          if (fetchError) {
            console.error('Fetch error:', fetchError)
            setError(fetchError)
          } else {
            console.log('Fetched data:', executions)
            setData(executions)
          }
        }
      } catch (err) {
        console.error('Unexpected error:', err)
        setError(err)
        setStatus('Unexpected error!')
      }
    }

    testConnection()
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>
      
      <div className="mb-4">
        <p className="font-semibold">Status: {status}</p>
        <p className="text-sm text-gray-600">URL: {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <p className="font-bold">Error:</p>
          <pre className="text-sm">{JSON.stringify(error, null, 2)}</pre>
        </div>
      )}

      {data && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          <p className="font-bold">Data fetched successfully!</p>
          <p className="text-sm">Found {data.length} records</p>
          <pre className="text-xs mt-2">{JSON.stringify(data, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}