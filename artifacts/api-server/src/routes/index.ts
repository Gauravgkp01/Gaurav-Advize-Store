import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import storesRouter from "./stores";
import productsRouter from "./products";
import reviewsRouter from "./reviews";
import analyticsRouter from "./analytics";
import uploadRouter from "./upload";
import paymentsRouter from "./payments";
import ordersRouter from "./orders";
import cashfreeRouter from "./cashfree";
import sitemapRouter from "./sitemap";
import storefrontRouter from "./storefront";
import productDetailRouter from "./product-detail";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
// Combined storefront endpoint first — before storesRouter so /storefront/:slug
// is matched before /stores/:slug
router.use(storefrontRouter);
router.use(productDetailRouter);
router.use(storesRouter);
router.use(productsRouter);
router.use(reviewsRouter);
router.use(analyticsRouter);
router.use(uploadRouter);
router.use(paymentsRouter);
router.use(ordersRouter);
router.use(cashfreeRouter);
router.use(sitemapRouter);

export default router;
