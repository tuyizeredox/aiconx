import { FastifyInstance } from 'fastify';
import { escapeRegex } from '../utils/sanitize';
import { Community, ICommunity } from '../models/Community';
import { CommunityMember } from '../models/CommunityMember';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

export async function communityRoutes(fastify: FastifyInstance) {
  // List communities with filtering and search
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        category,
        owner_username,
        is_public,
        search,
        sort = '-member_count',
        limit = 20,
        skip = 0
      } = query;

      // Build filter object
      const filter: any = {};

      if (category) filter.category = category;
      if (owner_username) filter.owner_username = owner_username;
      
      // Default to public if not specified, otherwise filter by provided value
      if (is_public !== undefined) {
        filter.is_public = is_public === 'true';
      } else {
        filter.is_public = true;
      }

      // Text search
      if (search) {
        const escaped = escapeRegex(search);
        filter.$or = [
          { name: { $regex: escaped, $options: 'i' } },
          { description: { $regex: escaped, $options: 'i' } }
        ];
      }

      // Build sort object
      const sortObj: any = {};
      if (sort.startsWith('-')) {
        sortObj[sort.substring(1)] = -1;
      } else {
        sortObj[sort] = 1;
      }

      const communities = await Community
        .find(filter)
        .sort(sortObj)
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Community.countDocuments(filter);

      return reply.send({
        communities,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get community by ID
  fastify.get('/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      return reply.send(community);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get community by name
  fastify.get('/name/:name', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };

      const community = await Community.findOne({ name: name.toLowerCase() });

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      return reply.send(community);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Create community
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as Partial<ICommunity>;
      const user = request.user as any;

      // Validate required fields
      if (!body.name) {
        return reply.code(400).send({ error: 'Missing required field: name' });
      }

      // Check if community name is already taken
      const existingCommunity = await Community.findOne({
        name: { $regex: new RegExp(`^${escapeRegex(body.name)}$`, 'i') }
      });

      if (existingCommunity) {
        return reply.code(409).send({ error: 'Community name already exists' });
      }

      const community = new Community({
        ...body,
        name: body.name.toLowerCase(),
        owner_username: user.username,
        member_count: 1, // Owner is automatically a member
      });

      await community.save();

      // Add owner as first member in CommunityMember collection
      const ownerMember = new CommunityMember({
        community_id: community._id,
        member_username: user.username,
        role: 'admin'
      });
      await ownerMember.save();

      // Emit real-time event
      fastify.io?.emit('community:created', {
        community: community.toObject()
      });

      return reply.code(201).send(community);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Update community
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as Partial<ICommunity>;
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is the owner
      if (community.owner_username !== user.username) {
        return reply.code(403).send({ error: 'You can only update communities you own' });
      }

      // Prevent name changes
      if (body.name && body.name.toLowerCase() !== community.name) {
        return reply.code(400).send({ error: 'Community name cannot be changed' });
      }

      // Update allowed fields
      const allowedUpdates = ['description', 'cover_image', 'icon_url', 'category', 'featured_products', 'rules', 'is_public'];
      allowedUpdates.forEach(field => {
        const key = field as keyof ICommunity;
        if (body[key] !== undefined) {
          (community as any)[key] = body[key];
        }
      });

      await community.save();

      // Emit real-time event
      fastify.io?.emit('community:updated', {
        community: community.toObject()
      });

      return reply.send(community);
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Delete community
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is the owner
      if (community.owner_username !== user.username) {
        return reply.code(403).send({ error: 'You can only delete communities you own' });
      }

      await Community.findByIdAndDelete(id);

      // TODO: Clean up related data (posts, members, etc.)

      // Emit real-time event
      fastify.io?.emit('community:deleted', {
        community_id: id
      });

      return reply.send({ message: 'Community deleted successfully' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Get user's communities
  fastify.get('/user/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { role = 'owner', limit = 20, skip = 0 } = query; // role can be 'owner' or 'member'
      const user = request.user as any;

      const filter: any = {};

      if (role === 'owner') {
        filter.owner_username = user.username;
      } else {
        // Find communities where user is a member
        const memberships = await CommunityMember.find({ member_username: user.username });
        const communityIds = memberships.map(m => m.community_id);
        filter._id = { $in: communityIds };
      }

      const communities = await Community
        .find(filter)
        .sort({ created_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      const total = await Community.countDocuments(filter);

      return reply.send({
        communities,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Join community
  fastify.post('/:id/join', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      if (!community.is_public) {
        return reply.code(403).send({ error: 'This community is private' });
      }

      // Check if user is already a member
      const existingMember = await CommunityMember.findOne({
        community_id: id,
        member_username: user.username
      });

      if (existingMember) {
        return reply.code(409).send({ error: 'You are already a member of this community' });
      }

      // Add user to CommunityMember collection
      const member = new CommunityMember({
        community_id: id,
        member_username: user.username,
        role: 'member'
      });
      await member.save();

      // Increment member count
      community.member_count += 1;
      await community.save();

      // Create notification for community owner
      if (community.owner_username !== user.username) {
        // Fetch full user data to get display_name
        const userData = await User.findOne({ email: user.email }).lean();
        const display_name = userData?.display_name || user.username;

        const notification = new Notification({
          recipient_username: community.owner_username,
          type: 'follow',
          title: `${display_name} joined your community: ${community.name}`,
          sender_username: user.username,
          sender_name: display_name,
          link: `/community/${community._id}`,
          metadata: {
            community_id: community._id,
            member_id: member._id
          }
        });
        await notification.save();
        fastify.io?.to(`user:${community.owner_username}`).emit('notification:new', notification);
        NotificationService.sendPushNotification(community.owner_username, notification, fastify);
      }

      // Emit real-time event
      fastify.io?.emit('community:joined', {
        community_id: id,
        user_username: user.username,
        member_count: community.member_count
      });

      return reply.send({ message: 'Successfully joined community' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });

  // Leave community
  fastify.post('/:id/leave', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const community = await Community.findById(id);

      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Prevent owner from leaving
      if (community.owner_username === user.username) {
        return reply.code(400).send({ error: 'Community owner cannot leave the community' });
      }

      // Check if user is a member
      const membership = await CommunityMember.findOne({
        community_id: id,
        member_username: user.username
      });

      if (!membership) {
        return reply.code(404).send({ error: 'You are not a member of this community' });
      }

      // Remove user from CommunityMember collection
      await CommunityMember.findByIdAndDelete(membership._id);

      // Decrement member count
      if (community.member_count > 0) {
        community.member_count -= 1;
        await community.save();
      }

      // Emit real-time event
      fastify.io?.emit('community:left', {
        community_id: id,
        user_username: user.username,
        member_count: community.member_count
      });

      return reply.send({ message: 'Successfully left community' });
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ 
        error: 'Internal server error', 
        message: process.env.NODE_ENV === 'development' ? error.message : undefined 
      });
    }
  });
}