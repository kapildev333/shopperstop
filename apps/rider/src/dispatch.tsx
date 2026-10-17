import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Badge, Button, StatusMessage } from '@shopperstop/ui'
import { meQuery, rider } from './api'
import { useOnlineReport } from './location'

// The banner's availability. The state is the rider query's `isOnline` (design Decision 2); the answer is written back into that query.
export function Availability() {
  const queryClient = useQueryClient()
  const online = useQuery(meQuery).data?.isOnline ?? false
  const [message, setMessage] = useState<string>()

  const toggle = useMutation({
    mutationFn: async (next: boolean) => {
      const { data, error } = await rider.PUT('/me/availability', { body: { online: next } })
      if (error) throw error.error
      return data
    },
    onSuccess: (answered) => queryClient.setQueryData(meQuery.queryKey, answered),
    onError: () => setMessage('Could not change your status. Try again.'),
  })

  useOnlineReport(online, () => {
    setMessage('Allow location to go online')
    toggle.mutate(false)
  })

  return (
    <>
      <Badge variant={online ? 'success' : 'neutral'}>{online ? 'Online' : 'Offline'}</Badge>
      <Button
        variant="secondary"
        loading={toggle.isPending}
        onClick={() => {
          setMessage(undefined)
          toggle.mutate(!online)
        }}
      >
        {online ? 'Go offline' : 'Go online'}
      </Button>
      {message && (
        <StatusMessage tone="warning" className="basis-full">
          {message}
        </StatusMessage>
      )}
    </>
  )
}
