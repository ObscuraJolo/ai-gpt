import { openai } from '../config/openaiConfig.js';

export const getData = async (req, res) => {
  const question = req.body.question;
  console.log(req.body);
  const description = await openai.createChatCompletion({
    model: 'gpt-3.5-turbo',
    messages: [
      {
        role: 'user',
        content: `${question}`,
      },
    ],
    max_tokens: 100,
  });

  res.status(200).json({
    data: description.data.choices[0].message,
  });
};
