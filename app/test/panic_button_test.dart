import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:jagawarga/features/panic/panic_button.dart';

Widget _host({required Future<void> Function() onTriggered}) {
  return MaterialApp(
    home: Scaffold(
      backgroundColor: Colors.black,
      body: Center(child: PanicButton(onTriggered: onTriggered)),
    ),
  );
}

void main() {
  testWidgets('tidak memicu bila dilepas sebelum 1,5 detik', (tester) async {
    var calls = 0;
    await tester.pumpWidget(_host(onTriggered: () async => calls++));

    final gesture = await tester.startGesture(tester.getCenter(find.byType(PanicButton)));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 500));
    await gesture.up();
    await tester.pump(const Duration(seconds: 2));

    expect(calls, 0);
  });

  testWidgets('memicu tepat sekali bila ditahan lebih dari 1,5 detik', (tester) async {
    var calls = 0;
    await tester.pumpWidget(_host(onTriggered: () async => calls++));

    final gesture = await tester.startGesture(tester.getCenter(find.byType(PanicButton)));
    await tester.pump(const Duration(milliseconds: 200));
    await tester.pump(const Duration(milliseconds: 1600));
    await gesture.up();
    await tester.pump(const Duration(seconds: 1));

    expect(calls, 1);
  });
}
