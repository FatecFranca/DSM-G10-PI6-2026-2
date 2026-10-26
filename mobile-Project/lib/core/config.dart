abstract final class AppConfig {
  // backend-Project publicado na VM da Azure (o nginx encaminha /api/ para :3004).
  static const String apiBaseUrl =
      'https://pae-pi6.canadacentral.cloudapp.azure.com/api';

  static const Duration requestTimeout = Duration(seconds: 45);
}
