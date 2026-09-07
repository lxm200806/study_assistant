import { Request, Response } from 'express'
import { register, login, refreshToken, getProfile, completeOnboarding, wechatLoginStub, setActiveSubject } from '../services/auth.service'
import { archiveChild, createChild, listChildren, renameChild, setActiveLearner } from '../services/family.service'

export async function registerHandler(req: Request, res: Response) {
  try {
    const { username, password, accountType } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    
    const result = await register({ username, password, accountType })
    res.status(201).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function loginHandler(req: Request, res: Response) {
  try {
    const { username, password, accountType } = req.body
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' })
    }
    
    const result = await login({ username, password, accountType })
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function refreshHandler(req: Request, res: Response) {
  try {
    const { refreshToken: token } = req.body
    
    if (!token) {
      return res.status(400).json({ error: 'Refresh token is required' })
    }
    
    const result = await refreshToken(token)
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function profileHandler(req: Request, res: Response) {
  try {
    const user = await getProfile(req.userId!)
    res.status(200).json({ success: true, data: user })
  } catch (error) {
    res.status(404).json({ error: (error as Error).message })
  }
}

export async function onboardHandler(req: Request, res: Response) {
  try {
    const user = await completeOnboarding(req.userId!, req.body?.subject, req.body?.accountType)
    res.status(200).json({ success: true, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function setSubjectHandler(req: Request, res: Response) {
  try {
    const user = await setActiveSubject(req.userId!, String(req.body?.subject || ''))
    res.status(200).json({ success: true, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function listStudentsHandler(req: Request, res: Response) {
  try {
    const children = await listChildren(req.userId!)
    res.status(200).json({ success: true, data: children })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function createStudentHandler(req: Request, res: Response) {
  try {
    const learner = await createChild(req.userId!, String(req.body?.name || ''))
    const user = await getProfile(req.userId!)
    res.status(201).json({ success: true, learner, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function renameStudentHandler(req: Request, res: Response) {
  try {
    const learner = await renameChild(req.userId!, req.params.id, String(req.body?.name || ''))
    const user = await getProfile(req.userId!)
    res.status(200).json({ success: true, learner, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function archiveStudentHandler(req: Request, res: Response) {
  try {
    await archiveChild(req.userId!, req.params.id)
    const user = await getProfile(req.userId!)
    res.status(200).json({ success: true, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function setActiveStudentHandler(req: Request, res: Response) {
  try {
    const learner = await setActiveLearner(req.userId!, String(req.body?.studentId || req.body?.id || ''))
    const user = await getProfile(req.userId!)
    res.status(200).json({ success: true, learner, user })
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}

export async function wechatLoginHandler(req: Request, res: Response) {
  try {
    const { code } = req.body
    const result = await wechatLoginStub(code)
    res.status(200).json(result)
  } catch (error) {
    res.status(400).json({ error: (error as Error).message })
  }
}
