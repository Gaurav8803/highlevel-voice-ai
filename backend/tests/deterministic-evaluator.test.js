import { describe, expect, it } from 'vitest'

import {
  checkActionsExecution,
  checkCallDuration,
  checkConversationFlow,
  checkDataExtraction,
  checkEndCallProper,
  checkGreetingDelivered,
  checkResponseLatency,
  checkSpokenVsExecutedOutcomes,
  runDeterministicEvaluation,
} from '../src/services/deterministic-evaluator.js'
import { createMayaFixture } from './fixtures/maya-call.js'

function createAiSellsItselfFixture() {
  return {
    callLog: {
      executedActions: [
        {
          actionName: 'Follow Up Text',
          actionType: 'SMS',
          executedAt: '2026-06-19T18:17:14.663Z',
        },
      ],
      transcriptTurns: [
        {
          content: 'I’ll send you a quick text to schedule an AI Impact Assessment session.',
          endTime: 286.586,
          index: 19,
          role: 'agent',
          startTime: 268.498,
        },
        {
          content: 'an issue sending the text. No worries, Rajesh!',
          endTime: 295.467,
          index: 21,
          role: 'agent',
          startTime: 286.621,
        },
        {
          content: 'It looks like there was a technical issue on the backend while trying to send the text message.',
          endTime: 311.402,
          index: 23,
          role: 'agent',
          startTime: 301.174,
        },
      ],
    },
  }
}

describe('deterministic evaluator', function deterministicEvaluatorSuite() {
  it('passes the configured greeting check for Maya', function testGreetingCheck() {
    const { agent, callLog } = createMayaFixture()
    const check = checkGreetingDelivered(callLog.transcriptTurns, agent)

    expect(check.passed).toBe(true)
    expect(check.evidence.turnIndices).toEqual([0])
    expect(check.evidence.actual.wordMatchRatio).toBe(1)
  })

  it('passes the call duration check when the call stays under the configured max', function testCallDurationCheck() {
    const { agent, callLog } = createMayaFixture()
    const check = checkCallDuration(callLog, agent)

    expect(check.passed).toBe(true)
    expect(check.evidence.expected.maxCallDuration).toBe(300)
    expect(check.evidence.actual.duration).toBe(197)
  })

  it('fails missing appointment booking execution while preserving the executed support ticket', function testActionExecutionCheck() {
    const { agent, callLog } = createMayaFixture()
    const checks = checkActionsExecution(callLog, agent)
    const appointmentCheck = checks.find((check) => check.checkId === 'action_executed_appointment_booking_action')
    const supportTicketCheck = checks.find((check) => check.checkId === 'action_executed_support_ticket')

    expect(checks).toHaveLength(7)
    expect(appointmentCheck?.passed).toBe(false)
    expect(supportTicketCheck?.passed).toBe(true)
    expect(supportTicketCheck?.evidence.actual.executedAt).toBe('2026-06-19T18:00:25.690Z')
  })

  it('fails all in-call data extraction checks when no data was extracted', function testDataExtractionCheck() {
    const { agent, callLog } = createMayaFixture()
    const checks = checkDataExtraction(callLog, agent)

    expect(checks).toHaveLength(4)
    expect(checks.every((check) => check.passed === false)).toBe(true)
    expect(checks.map((check) => check.checkId)).toEqual([
      'data_extracted_first_name',
      'data_extracted_last_name',
      'data_extracted_email',
      'data_extracted_business_name',
    ])
  })

  it('passes the conversation flow sanity check for the Maya transcript', function testConversationFlowCheck() {
    const { callLog } = createMayaFixture()
    const check = checkConversationFlow(callLog.transcriptTurns)

    expect(check.passed).toBe(true)
    expect(check.evidence.actual.maxConsecutiveAgentTurns).toBe(2)
    expect(check.evidence.actual.silenceGaps).toEqual([])
  })

  it('ends with a farewell pattern on the last agent turn', function testEndCallCheck() {
    const { callLog } = createMayaFixture()
    const check = checkEndCallProper(callLog.transcriptTurns)

    expect(check.passed).toBe(true)
    expect(check.evidence.turnIndices).toEqual([35])
  })

  it('keeps response latency under the deterministic threshold', function testResponseLatencyCheck() {
    const { callLog } = createMayaFixture()
    const check = checkResponseLatency(callLog.transcriptTurns)

    expect(check.passed).toBe(true)
    expect(check.evidence.actual.maxResponseTime).toBeLessThanOrEqual(5)
    expect(check.evidence.actual.slowResponses).toEqual([])
  })

  it('flags when the agent says an SMS failed even though the SMS action executed', function testSpokenOutcomeMismatchCheck() {
    const { callLog } = createAiSellsItselfFixture()
    const checks = checkSpokenVsExecutedOutcomes(callLog.transcriptTurns, callLog.executedActions)
    const successClaimCheck = checks.find((check) => check.checkId === 'spoken_outcome_sms_19')
    const failureClaimCheck = checks.find((check) => check.checkId === 'spoken_failure_sms_21')

    expect(successClaimCheck?.passed).toBe(true)
    expect(failureClaimCheck?.passed).toBe(false)
    expect(failureClaimCheck?.evidence.turnIndices).toEqual([21])
    expect(failureClaimCheck?.recommendation).toContain('executed successfully')
  })

  it('aggregates the deterministic evaluation summary with the expected Maya failures', async function testRunDeterministicEvaluation() {
    const { agent, callLog } = createMayaFixture()
    const result = await runDeterministicEvaluation(callLog, agent)
    const failedChecks = result.checks.filter((check) => !check.passed).map((check) => check.checkId)

    expect(result.summary).toEqual({
      failed: 10,
      passed: 6,
      total: 16,
    })
    expect(failedChecks).toContain('action_executed_appointment_booking_action')
    expect(failedChecks).toContain('data_extracted_email')
  })
})
