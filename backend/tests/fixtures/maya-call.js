const mayaAgent = {
  actions: [
    {
      actionParameters: {
        contactFieldId: 'WJmglbZjQk1ShvUfsWNk',
      },
      actionType: 'IN_CALL_DATA_EXTRACTION',
      id: '6a35818e4cf5d858507d172f',
      name: 'First Name',
    },
    {
      actionParameters: {
        contactFieldId: 'zhNBnAkS4VNQMfVk2B5a',
      },
      actionType: 'IN_CALL_DATA_EXTRACTION',
      id: '6a35818e4cf5d88e6b7d1730',
      name: 'Last Name',
    },
    {
      actionParameters: {
        contactFieldId: 'sz8AvqeOSGTUyYxLK8Mk',
      },
      actionType: 'IN_CALL_DATA_EXTRACTION',
      id: '6a35818e4cf5d82b737d1731',
      name: 'Email',
    },
    {
      actionParameters: {
        contactFieldId: 'guO80T7nnLvsMCXI8cTp',
      },
      actionType: 'IN_CALL_DATA_EXTRACTION',
      id: '6a35818e4cf5d80df77d1732',
      name: 'Business Name',
    },
    {
      actionParameters: {},
      actionType: 'KNOWLEDGE_BASE',
      id: '6a35818e4cf5d8386a7d1733',
      name: 'knowledge_base',
    },
    {
      actionParameters: {
        calendarId: 'v0khYNX4awKAVz24BIGA',
      },
      actionType: 'APPOINTMENT_BOOKING',
      id: '6a35818e4cf5d8568a7d1736',
      name: 'Appointment Booking Action',
    },
    {
      actionParameters: {
        workflowId: 'ef894bbd-15e5-4daa-879e-d9b6a44c4844',
      },
      actionType: 'WORKFLOW_TRIGGER',
      id: '6a35818e4cf5d877bc7d1737',
      name: 'Support Ticket',
    },
  ],
  agentName: 'Maya',
  agentPrompt: 'Maya supports existing customers and new leads.',
  rawConfig: {
    maxCallDuration: 300,
    welcomeMessage: 'Hey, This is Maya from Maximos AI. How can I help you today?',
  },
}

const mayaCallLog = {
  duration: 197,
  executedActions: [
    {
      actionId: '6a35818e4cf5d877bc7d1737',
      actionName: 'Support Ticket',
      actionType: 'WORKFLOW_TRIGGER',
      executedAt: '2026-06-19T18:00:25.690Z',
    },
  ],
  extractedData: {},
  transcriptTurns: [
    { content: 'Hey, This is Maya from Maximos AI. How can I help you today?', endTime: 3.208, index: 0, role: 'agent', startTime: 0.225, toolArguments: null, toolName: null, toolType: null },
    { content: "I don't know what is that you can offer. ", endTime: 8.554, index: 1, role: 'user', startTime: 6.234, toolArguments: null, toolName: null, toolType: null },
    { content: "No problem! Can you tell me what challenge you're facing—lead generation, missed calls, or follow-ups? That'll help me explain better.", endTime: 16.577, index: 2, role: 'agent', startTime: 9.889, toolArguments: null, toolName: null, toolType: null },
    { content: "Oh, yeah. I'm not able to generate so many leads these days. ", endTime: 22.263999, index: 3, role: 'user', startTime: 18.423999, toolArguments: null, toolName: null, toolType: null },
    { content: 'Got it—Maximos AI can help by automating lead capture, sending instant follow-ups, and booking appointments for you. Would you like to explore this further?', endTime: 31.606, index: 4, role: 'agent', startTime: 23.374, toolArguments: null, toolName: null, toolType: null },
    { content: 'Yeah. ', endTime: 34.294, index: 5, role: 'user', startTime: 33.974, toolArguments: null, toolName: null, toolType: null },
    { content: 'But how would you get the leads data? ', endTime: 37.714, index: 6, role: 'user', startTime: 35.074, toolArguments: null, toolName: null, toolType: null },
    { content: 'Maximos AI integrates with your website, forms, or ads to capture leads automatically. It ensures no potential lead is missed. Does that sound like what you need?', endTime: 47.243, index: 7, role: 'agent', startTime: 39.034, toolArguments: null, toolName: null, toolType: null },
    { content: 'Alright. Sounds good. ', endTime: 50.314, index: 8, role: 'user', startTime: 49.194, toolArguments: null, toolName: null, toolType: null },
    { content: 'And how can I identify the data which you will collect from all these sources? ', endTime: 56.254, index: 9, role: 'user', startTime: 50.79399799999999, toolArguments: null, toolName: null, toolType: null },
    { content: 'Great question! Maximos AI collects key details like names, emails, phone numbers, and any custom fields you set up in your forms or ads. You’ll have full visibility into all the data through a centralized dashboard. Would you like to see a demo?', endTime: 70.798, index: 10, role: 'agent', startTime: 57.134, toolArguments: null, toolName: null, toolType: null },
    { content: 'Before that, can you also confirm if the details which we get How are these verified? ', endTime: 77.674, index: 11, role: 'user', startTime: 72.474, toolArguments: null, toolName: null, toolType: null },
    { content: 'Maximos AI uses email and phone validation tools to ensure the data is accurate. Invalid entries are flagged, so you only work with verified leads. Does that address your concern?', endTime: 87.922, index: 12, role: 'agent', startTime: 78.959, toolArguments: null, toolName: null, toolType: null },
    { content: "For now, yes. What's the next step I can do? ", endTime: 92.994, index: 13, role: 'user', startTime: 90.51400000000001, toolArguments: null, toolName: null, toolType: null },
    { content: 'We can book a quick discovery call to dive deeper and tailor a solution for you. Should I check available times?', endTime: 98.948, index: 14, role: 'agent', startTime: 93.874, toolArguments: null, toolName: null, toolType: null },
    { content: "Yes. Sure. That's true. ", endTime: 101.82399, index: 15, role: 'user', startTime: 100.623996, toolArguments: null, toolName: null, toolType: null },
    { content: '', endTime: 102.936, index: 16, role: 'action', startTime: 102.722, toolArguments: { endDate: '26-06-2026-10-58-33', startDate: '19-06-2026-10-58-33', timezone: 'America/Los_Angeles' }, toolName: 'get_available_slots', toolType: 'custom' },
    { content: 'It seems there are no available slots right now. Would you like me to connect you with a team member to assist further?', endTime: 108.689, index: 17, role: 'agent', startTime: 103.709, toolArguments: null, toolName: null, toolType: null },
    { content: 'Yeah. ', endTime: 109.744, index: 18, role: 'user', startTime: 109.504, toolArguments: null, toolName: null, toolType: null },
    { content: '', endTime: 111.553, index: 19, role: 'action', startTime: 111.134, toolArguments: { executionMessage: "Sure, I will forward your inquery to our team and they'll get back to you soon." }, toolName: 'support_ticket', toolType: 'custom' },
    { content: 'Sure, ', endTime: 111.816, index: 20, role: 'agent', startTime: 111.363, toolArguments: null, toolName: null, toolType: null },
    { content: "I will forward your inquery to our team and they'll get back to you soon.inquiry has been forwarded to our team. They'll reach out to you shortly. Let me know if there's anything else!", endTime: 120.965, index: 21, role: 'agent', startTime: 111.967, toolArguments: null, toolName: null, toolType: null },
    { content: 'But do you have my information? How will your team contact me? ', endTime: 125.763995, index: 22, role: 'user', startTime: 122.354, toolArguments: null, toolName: null, toolType: null },
    { content: 'I see we have your email as gauravsharma.8804@gmail.com. Is that correct, or would you like to update it?', endTime: 133.272, index: 23, role: 'agent', startTime: 127.049, toolArguments: null, toolName: null, toolType: null },
    { content: "Yeah. That's correct. But I wouldn't like to get connected over WhatsApp. ", endTime: 139.354, index: 24, role: 'user', startTime: 135.834, toolArguments: null, toolName: null, toolType: null },
    { content: "Got it. We'll ensure communication happens via email only. Let me know if there's anything else!", endTime: 145.512, index: 25, role: 'agent', startTime: 140.555, toolArguments: null, toolName: null, toolType: null },
    { content: "Yeah. I'm saying that I want to get connected over what's not on email. ", endTime: 151.914, index: 26, role: 'user', startTime: 147.74399, toolArguments: null, toolName: null, toolType: null },
    { content: "Understood! We'll make sure to connect with you over WhatsApp instead of email. Anything else you'd like to share?", endTime: 159.442, index: 27, role: 'agent', startTime: 153.649, toolArguments: null, toolName: null, toolType: null },
    { content: 'Yeah. How would you contact me WhatsApp? ', endTime: 163.904, index: 28, role: 'user', startTime: 160.894, toolArguments: null, toolName: null, toolType: null },
    { content: 'To connect via WhatsApp, we’d need your phone number. Would you like to share it for this purpose?', endTime: 168.39, index: 29, role: 'agent', startTime: 164.779, toolArguments: null, toolName: null, toolType: null },
    { content: 'Then why do you ask for this phone number before? ', endTime: 173.06401, index: 30, role: 'user', startTime: 170.204, toolArguments: null, toolName: null, toolType: null },
    { content: "You're absolutely right—I should've asked earlier. Could you share your phone number now so we can connect via WhatsApp?", endTime: 179.296, index: 31, role: 'agent', startTime: 174.501, toolArguments: null, toolName: null, toolType: null },
    { content: "No. Ready to be just send me an email whenever it's ready. ", endTime: 183.50399, index: 32, role: 'user', startTime: 180.86399, toolArguments: null, toolName: null, toolType: null },
    { content: "Got it! We'll reach out to you via email. Let me know if you need anything else.Have a great day!", endTime: 190.486, index: 33, role: 'agent', startTime: 185.307, toolArguments: null, toolName: null, toolType: null },
    { content: 'Alright. Bye. ', endTime: 192.234, index: 34, role: 'user', startTime: 191.674, toolArguments: null, toolName: null, toolType: null },
    { content: 'Thanks for your time! Have a great day ahead. Goodbye!', endTime: 196.171, index: 35, role: 'agent', startTime: 193.35, toolArguments: null, toolName: null, toolType: null },
    { content: '', endTime: null, index: 36, role: 'action', startTime: 196.326, toolArguments: { executionMessage: 'Thanks for your time! Have a great day ahead. Goodbye!' }, toolName: 'end_call', toolType: 'end_call' },
  ],
}

function createMayaFixture() {
  return {
    agent: structuredClone(mayaAgent),
    callLog: structuredClone(mayaCallLog),
  }
}

export { createMayaFixture }
