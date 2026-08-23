import { FastifyInstance } from 'fastify';
import { CommunityMember, ICommunityMember } from '../models/CommunityMember';
import { Community } from '../models/Community';
import { User } from '../models/User';
import { Notification } from '../models/Notification';
import { NotificationService } from '../services/notificationService';

export async function communityMemberRoutes(fastify: FastifyInstance) {
  // Get members of a community
  fastify.get('/', async (request, reply) => {
    try {
      const query = request.query as any;
      const {
        community_id,
        role,
        limit = 50,
        skip = 0
      } = query;

      if (!community_id) {
        return reply.code(400).send({ error: 'community_id is required' });
      }

      // Build filter object
      const filter: any = { community_id };

      if (role) filter.role = role;

      const members = await CommunityMember
        .find(filter)
        .sort({ joined_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // member_email is a string, so we can't use .populate()
      // If we need user info, we would need to fetch it separately by email.

      const total = await CommunityMember.countDocuments(filter);

      return reply.send({
        members,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Add member to community
  fastify.post('/', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { community_id: string; member_username?: string; role?: string };
      const user = request.user as any;

      const { community_id, member_username = user.username, role = 'member' } = body;

      // Check if community exists
      const community = await Community.findById(community_id);
      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is already a member
      const existingMember = await CommunityMember.findOne({
        community_id,
        member_username
      });

      if (existingMember) {
        return reply.code(409).send({ error: 'User is already a member of this community' });
      }

      // Check permissions for adding others
      if (member_username !== user.username) {
        // Only community owner or admin can add others
        const userMembership = await CommunityMember.findOne({
          community_id,
          member_username: user.username,
          role: { $in: ['admin', 'moderator'] }
        });

        if (!userMembership && community.owner_username !== user.username) {
          return reply.code(403).send({ error: 'You do not have permission to add members to this community' });
        }
      }

      const member = new CommunityMember({
        community_id,
        member_username,
        role,
      });

      await member.save();

      // Update community member count
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
          link: `/CommunityDetail?id=${community._id}`,
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
      fastify.io?.emit('community:member-joined', {
        community_id,
        member_username,
        role,
        member_count: community.member_count
      });

      return reply.code(201).send(member);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Update member role
  fastify.put('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const body = request.body as { role: string };
      const user = request.user as any;

      const member = await CommunityMember.findById(id);

      if (!member) {
        return reply.code(404).send({ error: 'Community member not found' });
      }

      // Check if user has permission to update roles
      const userMembership = await CommunityMember.findOne({
        community_id: member.community_id,
        member_username: user.username,
        role: 'admin'
      });

      const community = await Community.findById(member.community_id);
      const isOwner = community?.owner_username === user.username;

      if (!userMembership && !isOwner) {
        return reply.code(403).send({ error: 'You do not have permission to update member roles' });
      }

      // Validate role
      const validRoles = ['member', 'moderator', 'admin'];
      if (!validRoles.includes(body.role)) {
        return reply.code(400).send({ error: 'Invalid role. Must be member, moderator, or admin' });
      }

      member.role = body.role as 'member' | 'moderator' | 'admin';
      await member.save();

      // Emit real-time event
      fastify.io?.emit('community:member-role-updated', {
        community_id: member.community_id,
        member_username: member.member_username,
        role: member.role
      });

      return reply.send(member);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Remove member from community
  fastify.delete('/:id', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const user = request.user as any;

      const member = await CommunityMember.findById(id);

      if (!member) {
        return reply.code(404).send({ error: 'Community member not found' });
      }

      // Check permissions
      const canRemove = member.member_username === user.username || // User can remove themselves
        (await CommunityMember.findOne({ // Admins can remove others
          community_id: member.community_id,
          member_username: user.username,
          role: 'admin'
        })) ||
        (await Community.findById(member.community_id))?.owner_username === user.username; // Owner can remove anyone

      if (!canRemove) {
        return reply.code(403).send({ error: 'You do not have permission to remove this member' });
      }

      await CommunityMember.findByIdAndDelete(id);

      // Update community member count
      const community = await Community.findById(member.community_id);
      if (community && community.member_count > 0) {
        community.member_count -= 1;
        await community.save();
      }

      // Emit real-time event
      fastify.io?.emit('community:member-left', {
        community_id: member.community_id,
        member_username: member.member_username,
        member_count: community?.member_count || 0
      });

      return reply.send({ message: 'Member removed from community' });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Check membership status
  fastify.get('/check', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { community_id } = query;
      const user = request.user as any;

      if (!community_id) {
        return reply.code(400).send({ error: 'community_id is required' });
      }

      const membership = await CommunityMember.findOne({
        community_id,
        member_username: user.username
      });

      return reply.send({
        is_member: !!membership,
        role: membership?.role || null,
        joined_at: membership?.joined_at || null
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Get user's community memberships
  fastify.get('/me', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const query = request.query as any;
      const { limit = 20, skip = 0 } = query;
      const user = request.user as any;

      const memberships = await CommunityMember
        .find({ member_username: user.username })
        .sort({ joined_at: -1 })
        .limit(parseInt(limit))
        .skip(parseInt(skip));

      // community_id is a string, so we can't use .populate()
      // If we need community info, we would need to fetch it separately.

      const total = await CommunityMember.countDocuments({ member_username: user.username });

      return reply.send({
        memberships,
        pagination: {
          total,
          limit: parseInt(limit),
          skip: parseInt(skip),
          hasMore: total > parseInt(skip) + parseInt(limit)
        }
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });

  // Bulk add members (admin only)
  fastify.post('/bulk', {
    preHandler: fastify.authenticate
  }, async (request, reply) => {
    try {
      const body = request.body as { community_id: string; member_usernames: string[] };
      const user = request.user as any;

      const { community_id, member_usernames } = body;

      // Check if community exists
      const community = await Community.findById(community_id);
      if (!community) {
        return reply.code(404).send({ error: 'Community not found' });
      }

      // Check if user is admin or owner
      const isAdmin = await CommunityMember.findOne({
        community_id,
        member_username: user.username,
        role: 'admin'
      });

      if (community.owner_username !== user.username && !isAdmin) {
        return reply.code(403).send({ error: 'You do not have permission to bulk add members' });
      }

      const results = [];
      let addedCount = 0;

      for (const username of member_usernames) {
        try {
          // Check if already a member
          const existing = await CommunityMember.findOne({
            community_id,
            member_username: username
          });

          if (!existing) {
            const member = new CommunityMember({
              community_id,
              member_username: username,
              role: 'member',
            });
            await member.save();
            addedCount++;
            results.push({ username, status: 'added' });
          } else {
            results.push({ username, status: 'already_member' });
          }
        } catch (error) {
          results.push({ username, status: 'error', error: error instanceof Error ? error.message : 'Unknown error' });
        }
      }

      // Update community member count
      if (addedCount > 0) {
        community.member_count += addedCount;
        await community.save();
      }

      return reply.send({
        message: `Bulk operation completed. ${addedCount} members added.`,
        results,
        added_count: addedCount
      });
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: 'Internal server error' });
    }
  });
}