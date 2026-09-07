import { Router } from 'express'
import {
  registerHandler,
  loginHandler,
  refreshHandler,
  profileHandler,
  onboardHandler,
  wechatLoginHandler,
  setSubjectHandler,
  listStudentsHandler,
  createStudentHandler,
  renameStudentHandler,
  archiveStudentHandler,
  setActiveStudentHandler
} from '../controllers/auth.controller'
import { authMiddleware } from '../middleware/auth'

const router = Router()

router.post('/register', registerHandler)
router.post('/login', loginHandler)
router.post('/refresh', refreshHandler)
router.get('/profile', authMiddleware, profileHandler)
router.post('/onboard', authMiddleware, onboardHandler)
router.put('/subject', authMiddleware, setSubjectHandler)
router.get('/students', authMiddleware, listStudentsHandler)
router.post('/students', authMiddleware, createStudentHandler)
router.put('/students/active', authMiddleware, setActiveStudentHandler)
router.put('/students/:id', authMiddleware, renameStudentHandler)
router.delete('/students/:id', authMiddleware, archiveStudentHandler)
router.post('/wechat', wechatLoginHandler)

export default router
