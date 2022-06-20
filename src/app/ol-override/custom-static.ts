import Static from 'ol/source/ImageStatic';
import CustomReprojImage from './custom-reproj-image';
import {ENABLE_RASTER_REPROJECTION} from 'ol/reproj/common.js';
import {equals} from 'ol/extent.js';
import {equivalent} from 'ol/proj.js';

export class CustomStatic extends Static {

	cReprojectedRevision_: any;
	cReprojectedImage_: any;

	/**
   	* @param {import("../extent.js").Extent} extent Extent.
   	* @param {number} resolution Resolution.
   	* @param {number} pixelRatio Pixel ratio.
   	* @param {import("../proj/Projection.js").default} projection Projection.
   	* @return {import("../ImageBase.js").default} Single image.
   	*/
   override getImage (extent: any, resolution: any, pixelRatio: any, projection: any): any {
    const sourceProjection = this.getProjection();
    if (
      !ENABLE_RASTER_REPROJECTION ||
      !sourceProjection ||
      !projection ||
      equivalent(sourceProjection, projection)
    ) {
      if (sourceProjection) {
        projection = sourceProjection;
      }
      return this.getImageInternal(extent, resolution, pixelRatio, projection);
    } else {
      if (this.cReprojectedImage_) {
        if (
          this.cReprojectedRevision_ == this.getRevision() &&
          equivalent(this.cReprojectedImage_.getProjection(), projection) &&
          this.cReprojectedImage_.getResolution() == resolution &&
          equals(this.cReprojectedImage_.getExtent(), extent)
        ) {
          return this.cReprojectedImage_;
        }
        this.cReprojectedImage_.dispose();
        this.cReprojectedImage_ = null;
      }

      this.cReprojectedImage_ = new CustomReprojImage(
        sourceProjection,
        projection,
        extent,
        resolution,
        pixelRatio,
        (extent: any, resolution: any, pixelRatio: any) => {
          return this.getImageInternal(
            extent,
            resolution,
            pixelRatio,
            sourceProjection
          );
        },
        this.getInterpolate()
      );
      this.cReprojectedRevision_ = this.getRevision();

      return this.cReprojectedImage_;
    }
  }
}
