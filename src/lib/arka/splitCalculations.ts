import type { ArkaMember } from '../../types/arka'
import { estimateNimFromFiat } from './amounts'
import { calculatePercentageAmounts, createEqualPercentages } from './percentageSplits'

function applyMemberDue(
  member: ArkaMember,
  amountDueFiat: number,
  amountDueNim: number,
): ArkaMember {
  const paidFiat = member.amountPaidFiat
  const hasOverpayment = paidFiat > amountDueFiat
  const status = hasOverpayment
    ? 'refund-needed'
    : amountDueFiat <= 0
      ? paidFiat > 0 ? 'refund-needed' : 'joined'
      : paidFiat >= amountDueFiat
        ? 'paid'
        : paidFiat > 0
          ? 'partial'
          : 'pending'

  return {
    ...member,
    amountDueFiat,
    amountDueNim,
    amountDueUsdt: amountDueFiat,
    status,
    paidAt: status === 'paid' ? member.paidAt : undefined,
  }
}

export function hasMemberContributions(members: ArkaMember[]) {
  return members.some((member) => (
    member.amountPaidFiat > 0
    || member.amountPaidNim > 0
    || (member.amountPaidUsdt ?? 0) > 0
  ))
}

export function calculateEqualSplit(totalFiat: number, totalNim: number, memberCount: number) {
  const count = Math.max(memberCount, 1)
  const amountDueFiat = Number((totalFiat / count).toFixed(2))
  const amountDueNim = estimateNimFromFiat(amountDueFiat, totalFiat, totalNim)

  return {
    amountDueFiat,
    amountDueNim,
  }
}

export function applyEqualSplit(members: ArkaMember[], totalFiat: number, totalNim: number) {
  if (members.length === 0) return members

  const percentages = createEqualPercentages(members.length)
  const fiatAmounts = calculatePercentageAmounts(totalFiat, percentages)
  const nimAmounts = calculatePercentageAmounts(totalNim, percentages, 5)

  return members.map((member, index) => applyMemberDue(member, fiatAmounts[index], nimAmounts[index]))
}

export function applyPercentageSplit(
  members: ArkaMember[],
  totalFiat: number,
  totalNim: number,
  percentages: number[],
) {
  const percentageTotal = percentages.reduce((total, percentage) => total + percentage, 0)
  const isValid = percentages.length === members.length
    && percentages.every((percentage) => Number.isFinite(percentage) && percentage >= 0)
    && Math.abs(percentageTotal - 100) <= 0.05

  if (!isValid) return members

  const fiatAmounts = calculatePercentageAmounts(totalFiat, percentages)
  const nimAmounts = calculatePercentageAmounts(totalNim, percentages, 5)

  return members.map((member, index) => applyMemberDue(member, fiatAmounts[index], nimAmounts[index]))
}

export function applySponsorSplit(
  members: ArkaMember[],
  totalFiat: number,
  totalNim: number,
  sponsorMemberId: string,
) {
  if (!members.some((member) => member.id === sponsorMemberId)) return members

  return members.map((member) => applyMemberDue(
    member,
    member.id === sponsorMemberId ? totalFiat : 0,
    member.id === sponsorMemberId ? totalNim : 0,
  ))
}
