class Membership {
  const Membership({
    required this.id,
    required this.communityId,
    required this.communityName,
    required this.role,
    this.houseId,
    this.houseLabel,
    this.isHouseholdHead = false,
  });

  final String id;
  final String communityId;
  final String communityName;
  final String role;
  final String? houseId;
  final String? houseLabel;
  final bool isHouseholdHead;

  bool get isStaff => role == 'admin' || role == 'pengurus';
  bool get canRespondAlert => role == 'admin' || role == 'pengurus' || role == 'satpam';

  factory Membership.fromJson(Map<String, dynamic> json) => Membership(
        id: json['id'] as String,
        communityId: json['communityId'] as String,
        communityName: json['communityName'] as String? ?? '',
        role: json['role'] as String? ?? 'warga',
        houseId: json['houseId'] as String?,
        houseLabel: json['houseLabel'] as String?,
        isHouseholdHead: json['isHouseholdHead'] as bool? ?? false,
      );
}

class Me {
  const Me({
    required this.id,
    required this.name,
    required this.phone,
    required this.isPlatformAdmin,
    required this.interests,
    required this.directoryVisible,
    this.bio,
    this.avatarMediaId,
  });

  final String id;
  final String name;
  final String phone;
  final bool isPlatformAdmin;
  final List<String> interests;
  final bool directoryVisible;
  final String? bio;
  final String? avatarMediaId;

  factory Me.fromJson(Map<String, dynamic> json) => Me(
        id: json['id'] as String,
        name: json['name'] as String,
        phone: json['phone'] as String,
        isPlatformAdmin: json['isPlatformAdmin'] as bool? ?? false,
        interests: ((json['interests'] as List?) ?? const []).cast<String>(),
        directoryVisible: json['directoryVisible'] as bool? ?? true,
        bio: json['bio'] as String?,
        avatarMediaId: json['avatarMediaId'] as String?,
      );
}

class AlertItem {
  const AlertItem({
    required this.id,
    required this.kind,
    required this.status,
    required this.triggeredByName,
    required this.createdAt,
    required this.eventCount,
    this.houseLabel,
    this.message,
    this.acknowledgedByName,
    this.acknowledgedAt,
    this.resolvedByName,
    this.resolvedAt,
    this.resolution,
    this.triggeredBy = '',
  });

  final String id;
  final String kind;
  final String status;
  final String triggeredBy;
  final String triggeredByName;
  final String? houseLabel;
  final String? message;
  final String? acknowledgedByName;
  final String? acknowledgedAt;
  final String? resolvedByName;
  final String? resolvedAt;
  final String? resolution;
  final String createdAt;
  final int eventCount;

  bool get isOpen => status == 'active' || status == 'acknowledged';

  factory AlertItem.fromJson(Map<String, dynamic> json) => AlertItem(
        id: json['id'] as String,
        kind: json['kind'] as String? ?? 'panic',
        status: json['status'] as String? ?? 'active',
        triggeredBy: json['triggeredBy'] as String? ?? '',
        triggeredByName: json['triggeredByName'] as String? ?? '',
        houseLabel: json['houseLabel'] as String?,
        message: json['message'] as String?,
        acknowledgedByName: json['acknowledgedByName'] as String?,
        acknowledgedAt: json['acknowledgedAt'] as String?,
        resolvedByName: json['resolvedByName'] as String?,
        resolvedAt: json['resolvedAt'] as String?,
        resolution: json['resolution'] as String?,
        createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
        eventCount: (json['eventCount'] as num?)?.toInt() ?? 0,
      );
}

class AlertEventItem {
  const AlertEventItem({
    required this.type,
    required this.createdAt,
    this.actorName,
  });

  final String type;
  final String createdAt;
  final String? actorName;

  factory AlertEventItem.fromJson(Map<String, dynamic> json) => AlertEventItem(
        type: json['type'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        actorName: json['actorName'] as String?,
      );
}

class Announcement {
  const Announcement({
    required this.id,
    required this.title,
    required this.body,
    required this.category,
    required this.isPinned,
    required this.authorName,
    required this.createdAt,
    this.attachmentMediaId,
    this.publishedAt,
  });

  final String id;
  final String title;
  final String body;
  final String category;
  final bool isPinned;
  final String authorName;
  final String createdAt;
  final String? attachmentMediaId;
  final String? publishedAt;

  factory Announcement.fromJson(Map<String, dynamic> json) => Announcement(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        category: json['category'] as String? ?? 'umum',
        isPinned: json['isPinned'] as bool? ?? false,
        authorName: json['authorName'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        attachmentMediaId: json['attachmentMediaId'] as String?,
        publishedAt: json['publishedAt'] as String?,
      );
}

class Invoice {
  const Invoice({
    required this.id,
    required this.houseLabel,
    required this.period,
    required this.title,
    required this.amount,
    required this.paidAmount,
    required this.dueDate,
    required this.status,
  });

  final String id;
  final String houseLabel;
  final String period;
  final String title;
  final int amount;
  final int paidAmount;
  final String dueDate;
  final String status;

  int get remaining => (amount - paidAmount).clamp(0, amount);

  factory Invoice.fromJson(Map<String, dynamic> json) => Invoice(
        id: json['id'] as String,
        houseLabel: json['houseLabel'] as String? ?? '',
        period: json['period'] as String? ?? '',
        title: json['title'] as String? ?? '',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        paidAmount: (json['paidAmount'] as num?)?.toInt() ?? 0,
        dueDate: json['dueDate']?.toString() ?? '',
        status: json['status'] as String? ?? 'unpaid',
      );
}

class LedgerEntry {
  const LedgerEntry({
    required this.id,
    required this.direction,
    required this.category,
    required this.amount,
    required this.occurredOn,
    required this.description,
    required this.source,
  });

  final String id;
  final String direction;
  final String category;
  final int amount;
  final String occurredOn;
  final String description;
  final String source;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) => LedgerEntry(
        id: json['id'] as String,
        direction: json['direction'] as String? ?? 'income',
        category: json['category'] as String? ?? '',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        occurredOn: json['occurredOn']?.toString() ?? '',
        description: json['description'] as String? ?? '',
        source: json['source'] as String? ?? 'manual',
      );
}

class Summary {
  const Summary({
    required this.opening,
    required this.income,
    required this.expense,
    required this.closing,
  });

  final int opening;
  final int income;
  final int expense;
  final int closing;

  factory Summary.fromJson(Map<String, dynamic> json) => Summary(
        opening: (json['opening'] as num?)?.toInt() ?? 0,
        income: (json['income'] as num?)?.toInt() ?? 0,
        expense: (json['expense'] as num?)?.toInt() ?? 0,
        closing: (json['closing'] as num?)?.toInt() ?? 0,
      );
}

class Payment {
  const Payment({
    required this.id,
    required this.amount,
    required this.status,
    required this.reportedAt,
    this.note,
    this.proofMediaId,
    this.reportedByName = '',
  });

  final String id;
  final int amount;
  final String status;
  final String reportedAt;
  final String? note;
  final String? proofMediaId;
  final String reportedByName;

  factory Payment.fromJson(Map<String, dynamic> json) => Payment(
        id: json['id'] as String,
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'pending',
        reportedAt: json['reportedAt'] as String? ?? '',
        note: json['note'] as String?,
        proofMediaId: json['proofMediaId'] as String?,
        reportedByName: json['reportedByName'] as String? ?? '',
      );
}

class Campaign {
  const Campaign({
    required this.id,
    required this.title,
    required this.description,
    required this.targetAmount,
    required this.collectedAmount,
    required this.donorCount,
    required this.status,
    this.deadline,
  });

  final String id;
  final String title;
  final String description;
  final int targetAmount;
  final int collectedAmount;
  final int donorCount;
  final String status;
  final String? deadline;

  double get progress => targetAmount == 0 ? 0 : (collectedAmount / targetAmount).clamp(0, 1);

  factory Campaign.fromJson(Map<String, dynamic> json) => Campaign(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        description: json['description'] as String? ?? '',
        targetAmount: (json['targetAmount'] as num?)?.toInt() ?? 0,
        collectedAmount: (json['collectedAmount'] as num?)?.toInt() ?? 0,
        donorCount: (json['donorCount'] as num?)?.toInt() ?? 0,
        status: json['status'] as String? ?? 'open',
        deadline: json['deadline']?.toString(),
      );
}

class Donation {
  const Donation({required this.id, required this.donorName, required this.amount, required this.createdAt});

  final String id;
  final String donorName;
  final int amount;
  final String createdAt;

  factory Donation.fromJson(Map<String, dynamic> json) => Donation(
        id: json['id'] as String,
        donorName: json['donorName'] as String? ?? 'Warga',
        amount: (json['amount'] as num?)?.toInt() ?? 0,
        createdAt: json['createdAt'] as String? ?? '',
      );
}

class DirectoryEntry {
  const DirectoryEntry({
    required this.userId,
    required this.name,
    required this.interests,
    this.houseLabel,
    this.bio,
    this.waNumber,
  });

  final String userId;
  final String name;
  final List<String> interests;
  final String? houseLabel;
  final String? bio;
  final String? waNumber;

  factory DirectoryEntry.fromJson(Map<String, dynamic> json) => DirectoryEntry(
        userId: json['userId'] as String,
        name: json['name'] as String? ?? '',
        interests: ((json['interests'] as List?) ?? const []).cast<String>(),
        houseLabel: json['houseLabel'] as String?,
        bio: json['bio'] as String?,
        waNumber: json['waNumber'] as String?,
      );
}

class NotificationItem {
  const NotificationItem({
    required this.id,
    required this.type,
    required this.title,
    required this.body,
    required this.createdAt,
    required this.data,
    this.readAt,
  });

  final String id;
  final String type;
  final String title;
  final String body;
  final String createdAt;
  final Map<String, dynamic> data;
  final String? readAt;

  bool get isUnread => readAt == null;

  factory NotificationItem.fromJson(Map<String, dynamic> json) => NotificationItem(
        id: json['id'] as String,
        type: json['type'] as String? ?? '',
        title: json['title'] as String? ?? '',
        body: json['body'] as String? ?? '',
        createdAt: json['createdAt'] as String? ?? '',
        data: (json['data'] as Map?)?.cast<String, dynamic>() ?? const {},
        readAt: json['readAt'] as String?,
      );
}

class MemberItem {
  const MemberItem({
    required this.membershipId,
    required this.userId,
    required this.name,
    required this.phone,
    required this.role,
    required this.isHouseholdHead,
    this.houseLabel,
  });

  final String membershipId;
  final String userId;
  final String name;
  final String phone;
  final String role;
  final bool isHouseholdHead;
  final String? houseLabel;

  factory MemberItem.fromJson(Map<String, dynamic> json) => MemberItem(
        membershipId: json['membershipId'] as String,
        userId: json['userId'] as String,
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        role: json['role'] as String? ?? 'warga',
        isHouseholdHead: json['isHouseholdHead'] as bool? ?? false,
        houseLabel: json['houseLabel'] as String?,
      );
}

class HouseholdMember {
  const HouseholdMember({required this.userId, required this.name, required this.isHouseholdHead});

  final String userId;
  final String name;
  final bool isHouseholdHead;

  factory HouseholdMember.fromJson(Map<String, dynamic> json) => HouseholdMember(
        userId: json['userId'] as String,
        name: json['name'] as String? ?? '',
        isHouseholdHead: json['isHouseholdHead'] as bool? ?? false,
      );
}

class Household {
  const Household({this.houseLabel, this.headName, required this.members});

  final String? houseLabel;
  final String? headName;
  final List<HouseholdMember> members;
}
