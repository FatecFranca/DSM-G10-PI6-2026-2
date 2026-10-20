import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  for (final path in [
    'assets/brand/pae_logo.png',
    'assets/brand/2.0x/pae_logo.png',
    'assets/brand/3.0x/pae_logo.png',
  ]) {
    test('o logo PAE está no bundle: $path', () async {
      final data = await rootBundle.load(path);
      expect(data.lengthInBytes, greaterThan(0));
    });
  }
}
