import { getSessionUser } from '../../utils/session'

export default defineEventHandler(async (event) => {
  const user = getSessionUser(event)

  return {
    authenticated: Boolean(user),
    user
  }
})
