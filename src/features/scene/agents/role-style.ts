import type { StaffRole } from '../../../domain/project'

export const ROLE_COLORS: Record<StaffRole, string> = {
  'head-chef': '#b95f47',
  'sous-chef': '#7b5aa6',
  cdp: '#277c91',
  'busser-washer': '#b78a28',
}

export const roleLabel = (role: StaffRole) => role === 'busser-washer' ? 'Busser / washer' : role.replace('-', ' ').replace(/^./, (letter) => letter.toUpperCase())
