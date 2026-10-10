import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  Function as CloudFrontFunction,
  FunctionCode,
  FunctionEventType,
  FunctionRuntime,
  HttpVersion,
  OriginProtocolPolicy,
  OriginRequestPolicy,
  PriceClass,
  ResponseHeadersPolicy,
  ViewerProtocolPolicy,
} from 'aws-cdk-lib/aws-cloudfront';
import { HttpOrigin, S3BucketOrigin } from 'aws-cdk-lib/aws-cloudfront-origins';
import { BlockPublicAccess, Bucket, BucketEncryption } from 'aws-cdk-lib/aws-s3';
import { BucketDeployment, CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { originOf, type DeploymentConfig } from './config';
import { contentSecurityPolicy, PERMISSIONS_POLICY, securityHeaders } from './security-headers';
import { SPA_REWRITE_FUNCTION_CODE } from './spa-rewrite';

export interface WebProps {
  config: DeploymentConfig;
  apiDomainName: string;
}

/** SPA on a private bucket behind CloudFront, with `/api/*` forwarded to the HTTP API. */
export class Web extends Construct {
  readonly bucket: Bucket;
  readonly distribution: Distribution;

  constructor(scope: Construct, id: string, { config, apiDomainName }: WebProps) {
    super(scope, id);

    this.bucket = new Bucket(this, 'SiteBucket', {
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      encryption: BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const permissionsPolicy = {
      header: 'Permissions-Policy',
      value: PERMISSIONS_POLICY,
      override: true,
    };

    const siteHeaders = new ResponseHeadersPolicy(this, 'SiteHeaders', {
      responseHeadersPolicyName: `checkout-${config.stage}-site-headers`,
      securityHeadersBehavior: securityHeaders({
        contentSecurityPolicy: contentSecurityPolicy(originOf(config.gatewayBaseUrl)),
      }),
      customHeadersBehavior: { customHeaders: [permissionsPolicy] },
    });

    const apiHeaders = new ResponseHeadersPolicy(this, 'ApiHeaders', {
      responseHeadersPolicyName: `checkout-${config.stage}-api-headers`,
      securityHeadersBehavior: securityHeaders({}),
      customHeadersBehavior: { customHeaders: [permissionsPolicy] },
    });

    const spaRewrite = new CloudFrontFunction(this, 'SpaRewrite', {
      functionName: `checkout-${config.stage}-spa-rewrite`,
      code: FunctionCode.fromInline(SPA_REWRITE_FUNCTION_CODE),
      runtime: FunctionRuntime.JS_2_0,
    });

    this.distribution = new Distribution(this, 'Distribution', {
      comment: `checkout-${config.stage}`,
      defaultRootObject: 'index.html',
      httpVersion: HttpVersion.HTTP2_AND_3,
      priceClass: PriceClass.PRICE_CLASS_100,
      defaultBehavior: {
        origin: S3BucketOrigin.withOriginAccessControl(this.bucket),
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: CachePolicy.CACHING_OPTIMIZED,
        responseHeadersPolicy: siteHeaders,
        compress: true,
        functionAssociations: [
          { function: spaRewrite, eventType: FunctionEventType.VIEWER_REQUEST },
        ],
      },
      additionalBehaviors: {
        '/api/*': {
          origin: new HttpOrigin(apiDomainName, {
            protocolPolicy: OriginProtocolPolicy.HTTPS_ONLY,
          }),
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER,
          responseHeadersPolicy: apiHeaders,
        },
      },
    });

    // Hashed assets are immutable; index.html must always be revalidated.
    new BucketDeployment(this, 'DeployAssets', {
      destinationBucket: this.bucket,
      sources: [Source.asset(config.webDistPath, { exclude: ['index.html'] })],
      cacheControl: [CacheControl.fromString('public, max-age=31536000, immutable')],
      prune: false,
    });

    new BucketDeployment(this, 'DeployIndex', {
      destinationBucket: this.bucket,
      sources: [Source.asset(config.webDistPath, { exclude: ['*', '!index.html'] })],
      cacheControl: [CacheControl.maxAge(Duration.seconds(0)), CacheControl.mustRevalidate()],
      prune: false,
      distribution: this.distribution,
      distributionPaths: ['/index.html'],
    });
  }
}
