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
  const amountDueFiat = Number((totalFiat / count).toFixed(5))
  const amountDueNim = estimateNimFromFiat(amountDueFiat, totalFiat, totalNim)

  return {
    amountDueFiat,
    amountDueNim,
  }
}

export function applyEqualSplit(members: ArkaMember[], totalFiat: number, totalNim: number) {
  if (members.length === 0) return members

  const percentages = createEqualPercentages(members.length)
  const fiatAmounts = calculatePercentageAmounts(totalFiat, percentages, 5)
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

  const fiatAmounts = calculatePercentageAmounts(totalFiat, percentages, 5)
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

  return members.map((member) => {
    const isSponsor = member.id === sponsorMemberId
    const updatedMember = applyMemberDue(
      member,
      isSponsor ? totalFiat : 0,
      isSponsor ? totalNim : 0,
    )

    if (!isSponsor || member.role !== 'host') return updatedMember

    /*
     * Guest contributions are transferred to the host wallet. When the host
     * is selected, that same wallet already holds the funds, so a self-payment
     * would be both unnecessary and rejected by Nimiq Hub. Treat the host's
     * share as covered and proceed to the merchant settlement instead.
     */
    return {
      ...updatedMember,
      amountPaidFiat: totalFiat,
      amountPaidNim: totalNim,
      amountPaidUsdt: 0,
      status: 'paid' as const,
      paidAt: member.paidAt,
    }
  })
}

export function applyHostShareCovered(members: ArkaMember[], hostId: string, paidAt = new Date().toISOString()) {
  return members.map((member) => {
    const isHost = member.role === 'host' || member.userId === hostId
    if (!isHost || member.amountDueFiat <= 0) return member

    return {
      ...member,
      amountPaidFiat: member.amountDueFiat,
      amountPaidNim: member.amountDueNim,
      amountPaidUsdt: 0,
      status: 'paid' as const,
      paidAt,
    }
  })
}
