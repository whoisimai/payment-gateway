import { Router } from "express"

import {Pay, Notify} from '../controller/payfast'
import {CreateOrder, UpdateOrderStatus, trackingInfo} from '../controller/order'

const router = Router()

router.post("/pay", Pay)
router.post("/notify_url", Notify)
router.post("/orders/create", CreateOrder)
router.put("/orders/:orderId/status", UpdateOrderStatus)
router.get("/track/:orderId", trackingInfo)

export default router