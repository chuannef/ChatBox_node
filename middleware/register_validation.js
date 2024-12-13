import { body, validationResult } from 'express-validator';

export const registerValidation = [
  body('username') 
  .trim()
  .notEmpty()
  .withMessage('username is required')
  .matches(/^[a-zA-Z0-9_]+$/)
  .withMessage('username can only contain letters, numbers and underscores')
  .isLength({ min: 4, max: 12 })
  .withMessage('username must be between 4 and 12')
  .escape(),

  body('password')
  .trim()
  .notEmpty()
  .withMessage('Password is required')
  .isLength({ min: 5 })
  .withMessage('password must be at least 5 characters long'),

  validationResult
]
