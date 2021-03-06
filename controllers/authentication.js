'use strict';

const passport = require('koa-passport');
const compose = require('koa-compose');

const {
  validateRegistrationInput,
  validateAdminRegistrationInput,
  validateRegistrationInfoQuery,
  validateForgotPasswordInput,
  validateResetPasswordInput,
} = require('../validation/authentication');

module.exports = {
  login: compose([
    (ctx, next) => {
      return passport.authenticate('local', { session: false }, (err, user, info) => {
        if (err) {
          strapi.eventHub.emit('admin.auth.error', { error: err, provider: 'local' });
          return ctx.badImplementation();
        }

        if (!user) {
          strapi.eventHub.emit('admin.auth.error', {
            error: new Error(info.message),
            provider: 'local',
          });
          return ctx.badRequest(info.message);
        }

        ctx.state.user = user;

        strapi.eventHub.emit('admin.auth.success', { user, provider: 'local' });

        return next();
      })(ctx, next);
    },
    ctx => {
      const { user } = ctx.state;

      const token = strapi.admin.services.token.createJwtToken(user);
      ctx.cookies.set("jwtToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production" ? true : false,
        maxAge: 1000 * 60 * 15,
      });

      ctx.body = {
        data: {
          status: 'Authenticated',
          user: strapi.admin.services.user.sanitizeUser(ctx.state.user),
        },
      };
    },
  ]),

  renewToken(ctx) {
    const token = ctx.request.header.cookie && ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)')) 
    ? ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)'))[2] : undefined;

    if (token === undefined) {
      return ctx.badRequest('Missing token');
    }

    const { isValid, payload } = strapi.admin.services.token.decodeJwtToken(token);

    if (!isValid) {
      return ctx.badRequest('Invalid token');
    }

    ctx.body = {
      data: {
        token: strapi.admin.services.token.createJwtToken({ id: payload.id }),
      },
    };
  },

  async registrationInfo(ctx) {
    try {
      await validateRegistrationInfoQuery(ctx.request.query);
    } catch (err) {
      return ctx.badRequest('QueryError', err);
    }

    const { registrationToken } = ctx.request.query;

    const registrationInfo = await strapi.admin.services.user.findRegistrationInfo(
      registrationToken
    );

    if (!registrationInfo) {
      return ctx.badRequest('Invalid registrationToken');
    }

    ctx.body = { data: registrationInfo };
  },

  async register(ctx) {
    const input = ctx.request.body;

    try {
      await validateRegistrationInput(input);
    } catch (err) {
      return ctx.badRequest('ValidationError', err);
    }

    const user = await strapi.admin.services.user.register(input);

    ctx.body = {
      data: {
        token: strapi.admin.services.token.createJwtToken(user),
        user: strapi.admin.services.user.sanitizeUser(user),
      },
    };
  },

  async registerAdmin(ctx) {
    const input = ctx.request.body;

    try {
      await validateAdminRegistrationInput(input);
    } catch (err) {
      return ctx.badRequest('ValidationError', err);
    }

    const hasAdmin = await strapi.admin.services.user.exists();

    if (hasAdmin) {
      return ctx.badRequest('You cannot register a new super admin');
    }

    const superAdminRole = await strapi.admin.services.role.getSuperAdmin();

    if (!superAdminRole) {
      throw new Error(
        "Cannot register the first admin because the super admin role doesn't exist."
      );
    }

    const user = await strapi.admin.services.user.create({
      ...input,
      registrationToken: null,
      isActive: true,
      roles: superAdminRole ? [superAdminRole.id] : [],
    });

    await strapi.telemetry.send('didCreateFirstAdmin');

    const token = strapi.admin.services.token.createJwtToken(user);
    ctx.cookies.set("jwtToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      maxAge: 1000 * 60 * 15,
    });

    ctx.body = {
      data: {
        user: strapi.admin.services.user.sanitizeUser(user),
      },
    };
  },

  async forgotPassword(ctx) {
    const input = ctx.request.body;

    try {
      await validateForgotPasswordInput(input);
    } catch (err) {
      return ctx.badRequest('ValidationError', err);
    }

    strapi.admin.services.auth.forgotPassword(input);

    ctx.status = 204;
  },

  async resetPassword(ctx) {
    const input = ctx.request.body;

    try {
      await validateResetPasswordInput(input);
    } catch (err) {
      return ctx.badRequest('ValidationError', err);
    }

    const user = await strapi.admin.services.auth.resetPassword(input);

    const token = strapi.admin.services.token.createJwtToken(user);

    ctx.cookies.set("jwtToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production" ? true : false,
      maxAge: 1000 * 60 * 15,
    });

    ctx.body = {
      data: {
        user: strapi.admin.services.user.sanitizeUser(user),
      },
    };
  },

  async logout(ctx) {
    const token = ctx.request.header.cookie && ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)')) 
    ? ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)'))[2] : undefined;

    if (token === undefined) {
      return ctx.badRequest('Missing token');
    }

    await strapi.query('revoke', 'admin').create({
      token: token,
    });

    ctx.cookies.set("jwtToken", null);
    ctx.cookies.set("jwtToken.sig", null);
    ctx.send({
      authorized: true,
      message: "Successfully destroyed session",
    });
  },

  async isAuthenticated(ctx) {
    const token = ctx.request.header.cookie && ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)')) 
      ? ctx.request.header.cookie.match(new RegExp('(^| )' + 'jwtToken' + '=([^;]+)'))[2] : undefined;

    if (!token) {
      return  ctx.send({
        authorized: false,
      });
    }

    const { isValid, payload } = strapi.admin.services.token.decodeJwtToken(token);

    if (!isValid) {
      return  ctx.send({
        authorized: false,
      });
    }

    ctx.send({
      authorized: true,
    });
  }
};
