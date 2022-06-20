import {ERROR_THRESHOLD} from 'ol/reproj/common.js';
import EventType from 'ol/events/EventType.js';
import ImageBase from 'ol/ImageBase.js';
import ImageState from 'ol/ImageState.js';
import Triangulation from 'ol/reproj/Triangulation.js';
import {
  calculateSourceResolution
} from 'ol/reproj.js';
import { getIntersection} from 'ol/extent.js';
import {listen, unlistenByKey} from 'ol/events.js';
import {IMAGE_SMOOTHING_DISABLED} from 'ol/renderer/canvas/common.js';
import {assign} from 'ol/obj.js';
import {
  createEmpty,
  extend,
  getCenter,
  getHeight,
  getTopLeft,
  getWidth,
} from 'ol/extent.js';
import {createCanvasContext2D} from 'ol/dom.js';
import {solveLinearSystem} from 'ol/math.js';
import axios from 'axios';

/**
 * @typedef {function(import("../extent.js").Extent, number, number) : import("../ImageBase.js").default} FunctionType
 */

/**
 * @classdesc
 * Class encapsulating single reprojected image.
 * See {@link module:ol/source/Image~ImageSource}.
 */
export class CustomReprojImage extends ImageBase {
	targetProj_;
	maxSourceExtent_;
	triangulation_;
	targetResolution_;
	targetExtent_;
	interpolate_;
	sourcePixelRatio_;
	sourceImage_;
	canvas_: any;
	sourceListenerKey_: any;
  /**
   * @param {import("../proj/Projection.js").default} sourceProj Source projection (of the data).
   * @param {import("../proj/Projection.js").default} targetProj Target projection.
   * @param {import("../extent.js").Extent} targetExtent Target extent.
   * @param {number} targetResolution Target resolution.
   * @param {number} pixelRatio Pixel ratio.
   * @param {FunctionType} getImageFunction
   *     Function returning source images (extent, resolution, pixelRatio).
   * @param {boolean} interpolate Use linear interpolation when resampling.
   */
  constructor(
    sourceProj: any,
    targetProj: any,
    targetExtent: any,
    targetResolution: any,
    pixelRatio: any,
    getImageFunction: any,
    interpolate: any
  ) {
    const maxSourceExtent = sourceProj.getExtent();
    const maxTargetExtent = targetProj.getExtent();

    const limitedTargetExtent = maxTargetExtent
      ? getIntersection(targetExtent, maxTargetExtent)
      : targetExtent;

    const targetCenter = getCenter(limitedTargetExtent);
    const sourceResolution = calculateSourceResolution(
      sourceProj,
      targetProj,
      targetCenter,
      targetResolution
    );

    const errorThresholdInPixels = ERROR_THRESHOLD;

    const triangulation = new Triangulation(
      sourceProj,
      targetProj,
      limitedTargetExtent,
      maxSourceExtent,
      sourceResolution * errorThresholdInPixels,
      targetResolution
    );

    const sourceExtent = triangulation.calculateSourceExtent();
    const sourceImage = getImageFunction(
      sourceExtent,
      sourceResolution,
      pixelRatio
    );
    const state = sourceImage ? ImageState.IDLE : ImageState.EMPTY;
    const sourcePixelRatio = sourceImage ? sourceImage.getPixelRatio() : 1;

    super(targetExtent, targetResolution, sourcePixelRatio, state);

    /**
     * @private
     * @type {import("../proj/Projection.js").default}
     */
    this.targetProj_ = targetProj;

    /**
     * @private
     * @type {import("../extent.js").Extent}
     */
    this.maxSourceExtent_ = maxSourceExtent;

    /**
     * @private
     * @type {!import("./Triangulation.js").default}
     */
    this.triangulation_ = triangulation;

    /**
     * @private
     * @type {number}
     */
    this.targetResolution_ = targetResolution;

    /**
     * @private
     * @type {import("../extent.js").Extent}
     */
    this.targetExtent_ = targetExtent;

    /**
     * @private
     * @type {import("../ImageBase.js").default}
     */
    this.sourceImage_ = sourceImage;

    /**
     * @private
     * @type {number}
     */
    this.sourcePixelRatio_ = sourcePixelRatio;

    /**
     * @private
     * @type {boolean}
     */
    this.interpolate_ = interpolate;

    /**
     * @private
     * @type {HTMLCanvasElement}
     */
    this.canvas_ = null;

    /**
     * @private
     * @type {?import("../events.js").EventsKey}
     */
    this.sourceListenerKey_ = null;
  }

  /**
   * Clean up.
   */
  override disposeInternal() {
    if (this.state == ImageState.LOADING) {
      this.unlistenSource_();
    }
    super.disposeInternal();
  }

  /**
   * @return {HTMLCanvasElement} Image.
   */
  override getImage() {
    return this.canvas_;
  }

  /**
   * @return {import("../proj/Projection.js").default} Projection.
   */
  getProjection() {
    return this.targetProj_;
  }

  /**
   * @private
   */
  reproject_() {
    const sourceState = this.sourceImage_.getState();
    if (sourceState == ImageState.LOADED) {
      const width = getWidth(this.targetExtent_) / this.targetResolution_;
      const height = getHeight(this.targetExtent_) / this.targetResolution_;

      this.canvas_ = this.render(
        width,
        height,
        this.sourcePixelRatio_,
        this.sourceImage_.getResolution(),
        this.maxSourceExtent_,
        this.targetResolution_,
        this.targetExtent_,
        this.triangulation_,
        [
          {
            extent: this.sourceImage_.getExtent(),
            image: this.sourceImage_.getImage(),
          },
        ],
        0,
        undefined,
        this.interpolate_
      );
    }
    this.state = sourceState;
    this.changed();
  }

  /**
   * Load not yet loaded URI.
   */
  override load() {
    if (this.state == ImageState.IDLE) {
      this.state = ImageState.LOADING;
      this.changed();

      const sourceState = this.sourceImage_.getState();
      if (sourceState == ImageState.LOADED || sourceState == ImageState.ERROR) {
        this.reproject_();
      } else {
        this.sourceListenerKey_ = listen(
          this.sourceImage_,
          EventType.CHANGE,
					(e) => {
            const sourceState = this.sourceImage_.getState();
            if (
              sourceState == ImageState.LOADED ||
              sourceState == ImageState.ERROR
            ) {
              this.unlistenSource_();
              this.reproject_();
            }
          },
          this
        );
        this.sourceImage_.load();
      }
    }
  }

  /**
   * @private
   */
  unlistenSource_() {
    unlistenByKey(
      /** @type {!import("../events.js").EventsKey} */ (this.sourceListenerKey_)
    );
    this.sourceListenerKey_ = null;
  }

	render(
		width,
		height,
		pixelRatio,
		sourceResolution,
		sourceExtent,
		targetResolution,
		targetExtent,
		triangulation,
		sources,
		gutter,
		opt_renderEdges,
		opt_interpolate
		) {
		const context = createCanvasContext2D(
			Math.round(pixelRatio * width),
			Math.round(pixelRatio * height)
		);
		
		if (!opt_interpolate) {
			assign(context, IMAGE_SMOOTHING_DISABLED);
		}
		
		if (sources.length === 0) {
			return context.canvas;
		}
		
		context.scale(pixelRatio, pixelRatio);
		context.globalCompositeOperation = 'lighter';
		
		const sourceDataExtent = createEmpty();
		sources.forEach(function (src, i, arr) {
			extend(sourceDataExtent, src.extent);
		});
		
		const canvasWidthInUnits = getWidth(sourceDataExtent);
		const canvasHeightInUnits = getHeight(sourceDataExtent);
		const stitchContext = createCanvasContext2D(
			Math.round((pixelRatio * canvasWidthInUnits) / sourceResolution),
			Math.round((pixelRatio * canvasHeightInUnits) / sourceResolution)
		);
		
		if (!opt_interpolate) {
			assign(stitchContext, IMAGE_SMOOTHING_DISABLED);
		}
		
		const stitchScale = pixelRatio / sourceResolution;
		
		sources.forEach(function (src, i, arr) {
			const xPos = src.extent[0] - sourceDataExtent[0];
			const yPos = -(src.extent[3] - sourceDataExtent[3]);
			const srcWidth = getWidth(src.extent);
			const srcHeight = getHeight(src.extent);
		
			// This test should never fail -- but it does. Need to find a fix the upstream condition
			if (src.image.width > 0 && src.image.height > 0) {
				stitchContext.drawImage(
					src.image,
					gutter,
					gutter,
					src.image.width - 2 * gutter,
					src.image.height - 2 * gutter,
					xPos * stitchScale,
					yPos * stitchScale,
					srcWidth * stitchScale,
					srcHeight * stitchScale
				);
			}
		});
		
		const targetTopLeft = getTopLeft(targetExtent);
		let canvasAsUrl = context.canvas.toDataURL();
		let stitchCanvasAsUrl = stitchContext.canvas.toDataURL();
		let canvasSize = { width: context.canvas.width, height: context.canvas.height };
		let stitchCanvasSize = { width: stitchContext.canvas.width, height: stitchContext.canvas.height };
		let data = { canvasSize, stitchCanvasSize, triangulation, pixelRatio, targetTopLeft, targetResolution, canvasAsUrl, sourceDataExtent, opt_interpolate, sourceResolution, stitchCanvasAsUrl, opt_renderEdges };
		
		axios.post('http://localhost:3000/drawCanvas', data).then(() => console.log('sended'));
		
		return this.exportedPart(triangulation, pixelRatio, targetTopLeft, targetResolution, context, sourceDataExtent, opt_interpolate, sourceResolution, stitchContext, opt_renderEdges);
	}

  exportedPart(triangulation, pixelRatio, targetTopLeft, targetResolution, context, sourceDataExtent, opt_interpolate, sourceResolution, stitchContext, opt_renderEdges) {
		function pixelRound(value) {
			return Math.round(value * pixelRatio) / pixelRatio;
		}
		
		triangulation.getTriangles().forEach(function (triangle, i, arr) {
			/* Calculate affine transform (src -> dst)
			* Resulting matrix can be used to transform coordinate
			* from `sourceProjection` to destination pixels.
			*
			* To optimize number of context calls and increase numerical stability,
			* we also do the following operations:
			* trans(-topLeftExtentCorner), scale(1 / targetResolution), scale(1, -1)
			* here before solving the linear system so [ui, vi] are pixel coordinates.
			*
			* Src points: xi, yi
			* Dst points: ui, vi
			* Affine coefficients: aij
			*
			* | x0 y0 1  0  0 0 |   |a00|   |u0|
			* | x1 y1 1  0  0 0 |   |a01|   |u1|
			* | x2 y2 1  0  0 0 | x |a02| = |u2|
			* |  0  0 0 x0 y0 1 |   |a10|   |v0|
			* |  0  0 0 x1 y1 1 |   |a11|   |v1|
			* |  0  0 0 x2 y2 1 |   |a12|   |v2|
			*/
			const source = triangle.source;
			const target = triangle.target;
			let x0 = source[0][0],
				y0 = source[0][1];
			let x1 = source[1][0],
				y1 = source[1][1];
			let x2 = source[2][0],
				y2 = source[2][1];
			// Make sure that everything is on pixel boundaries
			const u0 = pixelRound((target[0][0] - targetTopLeft[0]) / targetResolution);
			const v0 = pixelRound(
				-(target[0][1] - targetTopLeft[1]) / targetResolution
			);
			const u1 = pixelRound((target[1][0] - targetTopLeft[0]) / targetResolution);
			const v1 = pixelRound(
				-(target[1][1] - targetTopLeft[1]) / targetResolution
			);
			const u2 = pixelRound((target[2][0] - targetTopLeft[0]) / targetResolution);
			const v2 = pixelRound(
				-(target[2][1] - targetTopLeft[1]) / targetResolution
			);
		
			// Shift all the source points to improve numerical stability
			// of all the subsequent calculations. The [x0, y0] is used here.
			// This is also used to simplify the linear system.
			const sourceNumericalShiftX = x0;
			const sourceNumericalShiftY = y0;
			x0 = 0;
			y0 = 0;
			x1 -= sourceNumericalShiftX;
			y1 -= sourceNumericalShiftY;
			x2 -= sourceNumericalShiftX;
			y2 -= sourceNumericalShiftY;
		
			const augmentedMatrix = [
				[x1, y1, 0, 0, u1 - u0],
				[x2, y2, 0, 0, u2 - u0],
				[0, 0, x1, y1, v1 - v0],
				[0, 0, x2, y2, v2 - v0],
			];
			const affineCoefs = solveLinearSystem(augmentedMatrix);
			if (!affineCoefs) {
				return;
			}
		
			context.save();
			context.beginPath();
			context.moveTo(u1, v1);
			context.lineTo(u0, v0);
			context.lineTo(u2, v2);
			context.clip();
		
			context.transform(
				affineCoefs[0],
				affineCoefs[2],
				affineCoefs[1],
				affineCoefs[3],
				u0,
				v0
			);
		
			context.translate(
				sourceDataExtent[0] - sourceNumericalShiftX,
				sourceDataExtent[3] - sourceNumericalShiftY
			);
		
			context.scale(
				sourceResolution / pixelRatio,
				-sourceResolution / pixelRatio
			);
		
			context.drawImage(stitchContext.canvas, 0, 0);
			context.restore();
		});
		
	  return context.canvas;	
  }
}

export default CustomReprojImage;